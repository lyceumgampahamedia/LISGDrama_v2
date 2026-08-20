import {createHash} from "node:crypto";
import {initializeApp} from "firebase-admin/app";
import {FieldValue, Timestamp, getFirestore} from "firebase-admin/firestore";
import {defineSecret} from "firebase-functions/params";
import {HttpsError, onCall, onRequest} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {
  createPayHereCheckoutHash,
  createPayHereNotificationHash,
  formatPayHereAmount,
  parsePayHereFormBody,
  payHereStatus,
  signaturesMatch,
} from "./payhere.js";

initializeApp();
const db = getFirestore();
const REGION = "asia-south1";
const CURRENCY = "LKR";
const PAYMENT_HOLD_MS = 15 * 60 * 1000;
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 30 * 60 * 1000;
const MAX_SEATS = 8;
const MAX_SESSIONS_PER_WINDOW = 5;
const PAYHERE_LIVE_MERCHANT_ID = defineSecret("PAYHERE_LIVE_MERCHANT_ID");
const PAYHERE_LIVE_MERCHANT_SECRET = defineSecret("PAYHERE_LIVE_MERCHANT_SECRET");
const PAYHERE_NOTIFY_URL = "https://asia-south1-katanayaka-booking-v2.cloudfunctions.net/payhereNotify";

type ShowId = "show1" | "show2";
const seats = new Map<string, number>();
for (const block of [
  {p:"LA",n:96,v:2000},{p:"RA",n:104,v:2000},
  {p:"LB",n:96,v:1500},{p:"RB",n:104,v:1500},
  {p:"LC",n:96,v:1000},{p:"RC",n:104,v:1000},
]) {
  for (let number = 1; number <= block.n; number += 1) seats.set(`${block.p}${String(number).padStart(3,"0")}`, block.v);
}

function text(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "string") throw new HttpsError("invalid-argument", `${label} is required.`);
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (clean.length < min || clean.length > max) throw new HttpsError("invalid-argument", `${label} has an invalid length.`);
  return clean;
}
function show(value: unknown): ShowId {
  if (value !== "show1" && value !== "show2") throw new HttpsError("invalid-argument", "Unknown show.");
  return value;
}
function phone(value: unknown) {
  const clean = text(value,"Contact",9,15).replace(/[\s-]/g,"");
  if (/^0\d{9}$/.test(clean)) return `+94${clean.slice(1)}`;
  if (/^\+94\d{9}$/.test(clean)) return clean;
  throw new HttpsError("invalid-argument","Invalid Sri Lankan phone number.");
}
function seatIds(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_SEATS) throw new HttpsError("invalid-argument","Choose 1–8 seats.");
  const ids=value.map((id)=>text(id,"Seat",5,5).toUpperCase());
  if (new Set(ids).size!==ids.length || ids.some((id)=>!seats.has(id))) throw new HttpsError("invalid-argument","Invalid seat selection.");
  return ids;
}
function total(ids: string[]) { return ids.reduce((sum,id)=>sum+(seats.get(id)||0),0); }
function admin(request: {auth?: {token: Record<string, unknown>} | null}) {
  if (!request.auth || request.auth.token.admin !== true) throw new HttpsError("permission-denied","Admin access required.");
}
function signedInUser(request: {auth?: {uid: string; token: Record<string, unknown>} | null}) {
  const email=request.auth?.token.email;
  if (!request.auth || typeof email!=="string" || request.auth.token.email_verified!==true) throw new HttpsError("unauthenticated","Sign in with a verified Google account.");
  return {uid:request.auth.uid,email};
}
function active(data: FirebaseFirestore.DocumentData | undefined, now: number) {
  if (data?.status === "booked") return true;
  return data?.status === "reserved" && data.expiresAt instanceof Timestamp && data.expiresAt.toMillis() > now;
}
function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
function payHereCredentials() {
  const merchantId=PAYHERE_LIVE_MERCHANT_ID.value().trim(); const merchantSecret=PAYHERE_LIVE_MERCHANT_SECRET.value().trim();
  if (!merchantId || !merchantSecret) throw new HttpsError("failed-precondition","PayHere Live credentials are not configured.");
  return {merchantId,merchantSecret};
}

export const createPaymentSession = onCall({region:REGION,enforceAppCheck:true,cors:true,secrets:[PAYHERE_LIVE_MERCHANT_ID,PAYHERE_LIVE_MERCHANT_SECRET]}, async (request) => {
  const user=signedInUser(request);
  const payload=request.data as Record<string,unknown>;
  const showId=show(payload.showId); const ids=seatIds(payload.seatIds);
  const customer=(payload.customer||{}) as Record<string,unknown>;
  const name=text(customer.name || request.auth?.token.name,"Name",2,80);
  const contact=phone(customer.contact);
  const address=text(customer.address,"Address",5,160);
  const city=text(customer.city,"City",2,80);
  const idNumber=customer.idNumber?text(customer.idNumber,"ID",3,20):null;
  if (idNumber && !/^[A-Za-z0-9\-/ ]+$/.test(idNumber)) throw new HttpsError("invalid-argument","Unsupported ID characters.");

  const now=Date.now(); const expiresAt=Timestamp.fromMillis(now+PAYMENT_HOLD_MS);
  const reservation=db.collection("reservations").doc(); const session=db.collection("paymentSessions").doc();
  const reference=`GK-${reservation.id.slice(0,8).toUpperCase()}`;
  const refs=ids.map((id)=>db.doc(`shows/${showId}/seats/${id}`));
  const ip=request.rawRequest.ip || request.rawRequest.headers["x-forwarded-for"]?.toString() || "unknown";
  const limiter=db.collection("rateLimits").doc(sha256(`${ip}|${user.uid}`)); const amount=total(ids);
  const {merchantId,merchantSecret}=payHereCredentials(); const amountText=formatPayHereAmount(amount);

  await db.runTransaction(async (tx) => {
    const [rateSnap,...seatSnaps]=await Promise.all([tx.get(limiter),...refs.map((ref)=>tx.get(ref))]);
    const rate=rateSnap.data(); const started=rate?.windowStartedAt instanceof Timestamp?rate.windowStartedAt.toMillis():0;
    const inside=now-started<RATE_WINDOW_MS; const count=inside?Number(rate?.count||0):0;
    if (count>=MAX_SESSIONS_PER_WINDOW) throw new HttpsError("resource-exhausted","Too many recent payment attempts.");
    if (seatSnaps.some((snapshot)=>snapshot.exists && active(snapshot.data(),now))) throw new HttpsError("already-exists","A selected seat is unavailable.");
    tx.set(limiter,{count:count+1,windowStartedAt:Timestamp.fromMillis(inside?started:now),lastAttemptAt:FieldValue.serverTimestamp(),purgeAt:Timestamp.fromMillis(now+RATE_WINDOW_MS*2)});
    tx.create(reservation,{reference,showId,seatIds:ids,total:amount,currency:CURRENCY,status:"payment_pending",customer:{name,contact,email:user.email,address,city,country:"Sri Lanka",...(idNumber?{idNumber}:{})},userUid:user.uid,paymentSessionId:session.id,paymentGateway:"payhere",createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),expiresAt,purgeAt:Timestamp.fromMillis(now+RETENTION_MS)});
    tx.create(session,{reservationId:reservation.id,reference,userUid:user.uid,email:user.email,showId,seatIds:ids,amount,currency:CURRENCY,status:"created",paymentGateway:"payhere",createdAt:FieldValue.serverTimestamp(),expiresAt,purgeAt:Timestamp.fromMillis(now+RETENTION_MS)});
    refs.forEach((ref)=>tx.set(ref,{status:"reserved",reservationId:reservation.id,expiresAt,updatedAt:FieldValue.serverTimestamp()}));
  });
  const nameParts=name.split(/\s+/); const firstName=nameParts.shift()!; const lastName=nameParts.join(" ") || "Customer";
  const items=`Garu Katanayaka ${showId==="show1"?"3:30 PM":"6:30 PM"} - ${ids.join(", ")}`.slice(0,255);
  return {
    sessionId:session.id,reference,amount,currency:CURRENCY,expiresAtMs:expiresAt.toMillis(),
    payhere:{
      merchant_id:merchantId,notify_url:PAYHERE_NOTIFY_URL,order_id:session.id,items,currency:CURRENCY,amount:amountText,
      hash:createPayHereCheckoutHash(merchantId,session.id,amountText,CURRENCY,merchantSecret),
      first_name:firstName,last_name:lastName,email:user.email,phone:contact,address,city,country:"Sri Lanka",custom_1:reference,custom_2:session.id,
    },
  };
});

export const getPaymentStatus = onCall({region:REGION,enforceAppCheck:true,cors:true}, async (request) => {
  const user=signedInUser(request); const sessionId=text(request.data?.sessionId,"Payment session",10,100);
  const snapshot=await db.collection("paymentSessions").doc(sessionId).get();
  if (!snapshot.exists || snapshot.data()?.userUid!==user.uid) throw new HttpsError("not-found","Payment session not found.");
  const data=snapshot.data()!;
  return {status:data.status,reference:data.reference,showId:data.showId,amount:data.amount,currency:data.currency,seatIds:data.seatIds,expiresAtMs:data.expiresAt instanceof Timestamp?data.expiresAt.toMillis():null,paidAtMs:data.paidAt instanceof Timestamp?data.paidAt.toMillis():null};
});

export const cancelPaymentSession = onCall({region:REGION,enforceAppCheck:true,cors:true}, async (request) => {
  const user=signedInUser(request); const sessionId=text(request.data?.sessionId,"Payment session",10,100);
  const sessionRef=db.collection("paymentSessions").doc(sessionId);
  await db.runTransaction(async (tx) => {
    const sessionSnap=await tx.get(sessionRef);
    if (!sessionSnap.exists || sessionSnap.data()?.userUid!==user.uid) throw new HttpsError("not-found","Payment session not found.");
    const session=sessionSnap.data()!;
    if (session.status==="cancelled" || session.status==="expired" || session.status==="failed") return;
    if (session.status!=="created") throw new HttpsError("failed-precondition","A completed payment cannot be cancelled here.");
    const reservationRef=db.collection("reservations").doc(String(session.reservationId));
    const reservationSnap=await tx.get(reservationRef);
    if (!reservationSnap.exists) throw new HttpsError("not-found","Reservation missing.");
    const seatRefs=(session.seatIds as string[]).map((seatId)=>db.doc(`shows/${session.showId}/seats/${seatId}`));
    const seatSnaps=await Promise.all(seatRefs.map((seatRef)=>tx.get(seatRef)));
    seatSnaps.forEach((seat,index)=>{if(seat.data()?.reservationId===reservationSnap.id)tx.delete(seatRefs[index]);});
    tx.update(sessionRef,{status:"cancelled",cancelledBy:"customer",updatedAt:FieldValue.serverTimestamp()});
    tx.update(reservationRef,{status:"cancelled",cancelledAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
    tx.create(db.collection("auditLogs").doc(),{action:"checkout-cancelled-by-customer",reservationId:reservationSnap.id,reference:session.reference,actorUid:user.uid,createdAt:FieldValue.serverTimestamp()});
  });
  return {ok:true};
});

export const payhereNotify = onRequest({region:REGION,secrets:[PAYHERE_LIVE_MERCHANT_ID,PAYHERE_LIVE_MERCHANT_SECRET]}, async (req,res) => {
  try {
    if (req.method!=="POST") { res.status(405).send("Method not allowed"); return; }
    const body=parsePayHereFormBody(req.body); const {merchantId,merchantSecret}=payHereCredentials();
    const suppliedMerchant=text(body.merchant_id,"Merchant ID",1,80);
    const sessionId=text(body.order_id,"Order ID",10,100);
    const gatewayPaymentId=text(body.payment_id,"Payment ID",1,120);
    const payhereAmount=text(body.payhere_amount,"Amount",1,40);
    const currency=text(body.payhere_currency,"Currency",3,3).toUpperCase();
    const statusCode=text(body.status_code,"Status code",1,3);
    const suppliedSignature=text(body.md5sig,"Signature",32,64).toUpperCase();
    const status=payHereStatus(statusCode);
    if (suppliedMerchant!==merchantId) { res.status(401).send("Invalid merchant"); return; }
    if (!status) { res.status(400).send("Unsupported status"); return; }
    const expectedSignature=createPayHereNotificationHash(merchantId,sessionId,payhereAmount,currency,statusCode,merchantSecret);
    if (!signaturesMatch(suppliedSignature,expectedSignature)) { res.status(401).send("Invalid signature"); return; }

    const customReference=String(body.custom_1||"").trim(); const customSession=String(body.custom_2||"").trim();
    if (customSession && customSession!==sessionId) { res.status(400).send("Order mismatch"); return; }
    const eventId=`payhere_${sha256(`${sessionId}|${gatewayPaymentId}|${statusCode}`)}`; let outcome="processed";
    await db.runTransaction(async (tx) => {
      const eventRef=db.collection("paymentEvents").doc(eventId); const sessionRef=db.collection("paymentSessions").doc(sessionId);
      const [eventSnap,sessionSnap]=await Promise.all([tx.get(eventRef),tx.get(sessionRef)]);
      if (eventSnap.exists) { outcome="duplicate"; return; }
      if (!sessionSnap.exists) throw new HttpsError("not-found","Unknown payment session");
      const session=sessionSnap.data()!; const callbackAmount=Number(payhereAmount);
      if (!Number.isFinite(callbackAmount) || Math.round(callbackAmount*100)!==Math.round(Number(session.amount)*100) || currency!==session.currency) throw new HttpsError("invalid-argument","Payment amount or currency mismatch");
      if (customReference && customReference!==session.reference) throw new HttpsError("invalid-argument","Reference mismatch");
      const reservationRef=db.collection("reservations").doc(String(session.reservationId)); const reservationSnap=await tx.get(reservationRef);
      if (!reservationSnap.exists) throw new HttpsError("not-found","Reservation missing");
      const reservation=reservationSnap.data()!; const seatRefs=(session.seatIds as string[]).map((id)=>db.doc(`shows/${session.showId}/seats/${id}`));
      const seatSnaps=await Promise.all(seatRefs.map((ref)=>tx.get(ref))); const seatsStillOwned=seatSnaps.every((seat)=>seat.data()?.reservationId===reservationSnap.id);
      const gatewayFields={gatewayPaymentId,payhereStatusCode:statusCode,payhereMethod:String(body.method||"").slice(0,80),payhereStatusMessage:String(body.status_message||"").slice(0,240),gatewayUpdatedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()};

      if (status==="paid") {
        if (session.status==="paid") outcome="already-paid";
        else if (session.status!=="created" || !seatsStillOwned) {
          outcome="manual-review";
          tx.update(sessionRef,{...gatewayFields,gatewayReviewRequired:true,gatewayReviewReason:session.status!=="created"?`Session is ${session.status}`:"Seat ownership changed"});
        } else {
          tx.update(sessionRef,{...gatewayFields,status:"paid",paidAt:FieldValue.serverTimestamp()});
          tx.update(reservationRef,{status:"booked",gatewayPaymentId,paymentEventId:eventId,confirmedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
          seatRefs.forEach((ref)=>tx.update(ref,{status:"booked",expiresAt:FieldValue.delete(),updatedAt:FieldValue.serverTimestamp()}));
          const receiptText=["Payment received — Garu Katanayaka",`Reference: ${session.reference}`,`Show: ${session.showId==="show1"?"3:30 PM":"6:30 PM"}`,`Seats: ${(session.seatIds as string[]).join(", ")}`,`Amount: LKR ${Number(session.amount).toLocaleString("en-LK")}`,`PayHere payment ID: ${gatewayPaymentId}`,"Your seats are confirmed. Please retain this email as your receipt."].join("\n");
          tx.create(db.collection("mail").doc(),{to:[session.email],message:{subject:`Payment receipt ${session.reference}`,text:receiptText},reservationId:reservationSnap.id,paymentEventId:eventId,createdAt:FieldValue.serverTimestamp()});
        }
      } else if (status==="pending") {
        outcome=session.status==="created"?"pending":"ignored-after-final-state";
        tx.update(sessionRef,{...gatewayFields});
      } else if (status==="chargeback") {
        if (session.status==="paid" || session.status==="chargeback") {
          outcome="chargeback-review";
          tx.update(sessionRef,{...gatewayFields,status:"chargeback",gatewayReviewRequired:true});
          tx.update(reservationRef,{status:"chargeback",gatewayPaymentId,updatedAt:FieldValue.serverTimestamp()});
        } else if (session.status==="created") {
          outcome="chargeback-before-confirmation";
          tx.update(sessionRef,{...gatewayFields,status:"chargeback",gatewayReviewRequired:true});
          tx.update(reservationRef,{status:"chargeback",updatedAt:FieldValue.serverTimestamp()});
          seatSnaps.forEach((seat,index)=>{if(seat.data()?.reservationId===reservationSnap.id)tx.delete(seatRefs[index]);});
        } else outcome="ignored-after-final-state";
      } else if (session.status==="created") {
        tx.update(sessionRef,{...gatewayFields,status});
        tx.update(reservationRef,{status:status==="cancelled"?"cancelled":"payment_failed",updatedAt:FieldValue.serverTimestamp()});
        seatSnaps.forEach((seat,index)=>{if(seat.data()?.reservationId===reservationSnap.id)tx.delete(seatRefs[index]);});
      } else outcome="ignored-after-final-state";

      tx.create(eventRef,{eventId,provider:"payhere",sessionId,status,statusCode,payhereAmount,currency,gatewayPaymentId,outcome,method:String(body.method||"").slice(0,80),statusMessage:String(body.status_message||"").slice(0,240),processedAt:FieldValue.serverTimestamp(),purgeAt:Timestamp.fromMillis(Date.now()+RETENTION_MS)});
      tx.create(db.collection("auditLogs").doc(),{action:`payhere-${status}-${outcome}`,reservationId:reservationSnap.id,reference:reservation.reference,eventId,gatewayPaymentId,createdAt:FieldValue.serverTimestamp()});
    });
    res.status(200).send("OK");
  } catch (error) {
    console.error("payhereNotify",error);
    res.status(error instanceof HttpsError?400:500).send(error instanceof HttpsError?"Notification rejected":"Temporary error");
  }
});

export const createConfirmedReservation = onCall({region:REGION,enforceAppCheck:true,cors:true}, async (request) => {
  admin(request); const payload=request.data as Record<string,unknown>; const showId=show(payload.showId); const ids=seatIds(payload.seatIds);
  const customer=(payload.customer||{}) as Record<string,unknown>; const name=text(customer.name,"Name",2,80); const contact=phone(customer.contact);
  const idNumber=customer.idNumber?text(customer.idNumber,"ID",3,20):null;
  if (idNumber && !/^[A-Za-z0-9\-/ ]+$/.test(idNumber)) throw new HttpsError("invalid-argument","Unsupported ID characters.");
  const now=Date.now(); const reservation=db.collection("reservations").doc(); const reference=`GK-${reservation.id.slice(0,8).toUpperCase()}`;
  const refs=ids.map((id)=>db.doc(`shows/${showId}/seats/${id}`));
  await db.runTransaction(async (tx) => {
    const seatSnaps=await Promise.all(refs.map((ref)=>tx.get(ref)));
    if (seatSnaps.some((snapshot)=>snapshot.exists && active(snapshot.data(),now))) throw new HttpsError("already-exists","One or more seats are unavailable.");
    tx.create(reservation,{reference,showId,seatIds:ids,total:total(ids),currency:CURRENCY,status:"booked",source:"walk-in",customer:{name,contact,...(idNumber?{idNumber}:{})},createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),confirmedAt:FieldValue.serverTimestamp(),confirmedBy:request.auth!.uid,purgeAt:Timestamp.fromMillis(now+RETENTION_MS)});
    refs.forEach((ref)=>tx.set(ref,{status:"booked",reservationId:reservation.id,updatedAt:FieldValue.serverTimestamp()}));
    tx.create(db.collection("auditLogs").doc(),{action:"walk-in-booking-created",reservationId:reservation.id,reference,showId,seatIds:ids,actorUid:request.auth!.uid,createdAt:FieldValue.serverTimestamp()});
  });
  return {reference,seatIds:ids,total:total(ids)};
});

export const confirmPayment = onCall({region:REGION,enforceAppCheck:true,cors:true}, async (request) => {
  admin(request); const id=text(request.data?.reservationId,"Reservation",10,80); const ref=db.collection("reservations").doc(id);
  await db.runTransaction(async (tx)=>{const snap=await tx.get(ref); if(!snap.exists)throw new HttpsError("not-found","Reservation not found."); const data=snap.data()!; if(data.status==="booked")return; if(data.status!=="reserved" || data.expiresAt.toMillis()<=Date.now())throw new HttpsError("failed-precondition","Reservation is not active."); const seatRefs=(data.seatIds as string[]).map((seatId)=>db.doc(`shows/${data.showId}/seats/${seatId}`)); const seatSnaps=await Promise.all(seatRefs.map((seatRef)=>tx.get(seatRef))); if(seatSnaps.some((seat)=>seat.data()?.reservationId!==id))throw new HttpsError("failed-precondition","Seat ownership changed."); tx.update(ref,{status:"booked",confirmedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()}); seatRefs.forEach((seatRef)=>tx.update(seatRef,{status:"booked",expiresAt:FieldValue.delete(),updatedAt:FieldValue.serverTimestamp()})); tx.create(db.collection("auditLogs").doc(),{action:"payment-confirmed-manually",reservationId:id,reference:data.reference,actorUid:request.auth!.uid,createdAt:FieldValue.serverTimestamp()});}); return {ok:true};
});

export const cancelReservation = onCall({region:REGION,enforceAppCheck:true,cors:true}, async (request) => {
  admin(request); const id=text(request.data?.reservationId,"Reservation",10,80); const ref=db.collection("reservations").doc(id);
  await db.runTransaction(async (tx)=>{
    const snap=await tx.get(ref); if(!snap.exists)throw new HttpsError("not-found","Reservation not found."); const data=snap.data()!;
    if(!["reserved","booked","payment_pending"].includes(data.status))throw new HttpsError("failed-precondition","Reservation is inactive.");
    const sessionRef=data.paymentSessionId?db.collection("paymentSessions").doc(String(data.paymentSessionId)):null;
    const seatRefs=(data.seatIds as string[]).map((seatId)=>db.doc(`shows/${data.showId}/seats/${seatId}`));
    const [sessionSnap,...seatSnaps]=await Promise.all([sessionRef?tx.get(sessionRef):Promise.resolve(null),...seatRefs.map((seatRef)=>tx.get(seatRef))]);
    seatSnaps.forEach((seat,index)=>{if(seat?.data()?.reservationId===id)tx.delete(seatRefs[index]);});
    tx.update(ref,{status:"cancelled",cancelledAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),purgeAt:Timestamp.fromMillis(Date.now()+RETENTION_MS)});
    if(sessionRef && sessionSnap?.exists && sessionSnap.data()?.status==="created")tx.update(sessionRef,{status:"cancelled",updatedAt:FieldValue.serverTimestamp()});
    tx.create(db.collection("auditLogs").doc(),{action:"reservation-cancelled",reservationId:id,reference:data.reference,actorUid:request.auth!.uid,createdAt:FieldValue.serverTimestamp()});
  }); return {ok:true};
});

export const expireReservations = onSchedule({region:REGION,schedule:"every 5 minutes",timeZone:"Asia/Colombo"}, async()=>{
  const [legacy,payments]=await Promise.all([
    db.collection("reservations").where("status","==","reserved").where("expiresAt","<=",Timestamp.now()).limit(200).get(),
    db.collection("reservations").where("status","==","payment_pending").where("expiresAt","<=",Timestamp.now()).limit(200).get(),
  ]);
  await Promise.all([...legacy.docs,...payments.docs].map((doc)=>db.runTransaction(async(tx)=>{
    const snap=await tx.get(doc.ref); const data=snap.data();
    if(!data || !["reserved","payment_pending"].includes(data.status) || data.expiresAt.toMillis()>Date.now())return;
    const sessionRef=data.paymentSessionId?db.collection("paymentSessions").doc(String(data.paymentSessionId)):null;
    const refs=(data.seatIds as string[]).map((id)=>db.doc(`shows/${data.showId}/seats/${id}`));
    const [sessionSnap,...seatSnaps]=await Promise.all([sessionRef?tx.get(sessionRef):Promise.resolve(null),...refs.map((ref)=>tx.get(ref))]);
    seatSnaps.forEach((seat,index)=>{if(seat?.data()?.reservationId===snap.id)tx.delete(refs[index]);});
    tx.update(snap.ref,{status:"expired",expiredAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),purgeAt:Timestamp.fromMillis(Date.now()+RETENTION_MS)});
    if(sessionRef && sessionSnap?.exists && sessionSnap.data()?.status==="created")tx.update(sessionRef,{status:"expired",updatedAt:FieldValue.serverTimestamp()});
  })));
});

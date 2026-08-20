export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCVAVKlCwpsbeQnvCC3bL6rzbc_Rifnx9w",
  authDomain: "katanayaka-booking-v2.firebaseapp.com",
  projectId: "katanayaka-booking-v2",
  storageBucket: "katanayaka-booking-v2.firebasestorage.app",
  messagingSenderId: "575426124492",
  appId: "1:575426124492:web:20382ef60c51f7f9908069",
  measurementId: "G-B810STEKF3"
};

// Required before production: Firebase Console → App Check → reCAPTCHA v3.
export const APP_CHECK_SITE_KEY = "6Lf-2ostAAAAAI_6Ow39PK2R1wWg8lwIDJUAVBOr";
export const FUNCTIONS_REGION = "asia-south1";
// This verification build is intentionally locked to PayHere Live. The live
// Merchant Secret remains in Firebase Secret Manager and never reaches Vite.
export const PAYHERE_CHECKOUT_URL = "https://www.payhere.lk/pay/checkout";
export const MAX_SEATS = 8;

export function assetUrl(path) {
  return `${import.meta.env.BASE_URL}${String(path).replace(/^\/+/, "")}`;
}

export const SHOWS = {
  show1: { time: "3:30 PM", startsAt: "2026-09-03T15:30:00+05:30" },
  show2: { time: "6:30 PM", startsAt: "2026-09-03T18:30:00+05:30" },
};

export const BLOCKS = [
  { id: "AL", side: "left", tier: "A", prefix: "LA", price: 2000, total: 96, columns: 12, reverse: true },
  { id: "AR", side: "right", tier: "A", prefix: "RA", price: 2000, total: 104, columns: 13, reverse: true },
  { id: "BL", side: "left", tier: "B", prefix: "LB", price: 1500, total: 96, columns: 12, reverse: true },
  { id: "BR", side: "right", tier: "B", prefix: "RB", price: 1500, total: 104, columns: 13, reverse: true },
  { id: "CL", side: "left", tier: "C", prefix: "LC", price: 1000, total: 96, columns: 12, reverse: true },
  { id: "CR", side: "right", tier: "C", prefix: "RC", price: 1000, total: 104, columns: 13, reverse: true },
];

export const TIER_IDS = ["A", "B", "C"];
export const TIER_TOTALS = Object.freeze(Object.fromEntries(
  TIER_IDS.map((tier) => [tier, BLOCKS.filter((block) => block.tier === tier).reduce((sum, block) => sum + block.total, 0)]),
));

export function seatsForBlock(block) {
  if (block.total % block.columns !== 0) throw new Error(`${block.id}: total must be divisible by columns.`);
  const seats = [];
  for (let rowIndex = 0; rowIndex < block.total / block.columns; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < block.columns; columnIndex += 1) {
      const offset = block.reverse ? block.columns - columnIndex : columnIndex + 1;
      const number = rowIndex * block.columns + offset;
      seats.push({ id: `${block.prefix}${String(number).padStart(3, "0")}`, number, row: String.fromCharCode(65 + rowIndex), block });
    }
  }
  return seats;
}

export const ALL_SEATS = BLOCKS.flatMap(seatsForBlock);
export const SEAT_BY_ID = new Map(ALL_SEATS.map((seat) => [seat.id, seat]));
export const TOTAL_SEATS = ALL_SEATS.length;

export function formatLkr(amount, language = "en") {
  return new Intl.NumberFormat(language === "si" ? "si-LK" : "en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 0 }).format(amount);
}

export const COPY = {
  en: {
    kicker: "Drama seat reservations", title: "Garu Katanayaka", eventDate: "3 September 2026", venue: "Zeus Hall", school: "Lyceum International School Gampaha",
    loading: "Loading live availability…", live: "Live availability", loadError: "Availability could not be loaded. Check your connection.",
    guideTitle: "Reserve in three simple steps", guideText: "Choose a show, select up to 8 available seats, then submit your contact details once.", chooseShow: "Choose a show", afternoonShow: "Afternoon show", eveningShow: "Evening show", availableCount: "available", soldCount: "sold", totalSold: "Tickets sold across both shows", soldByBlock: "Confirmed tickets sold by block",
    holdTitle: "Secure checkout holds seats for 15 minutes", holdText: "Sign in with Google and complete payment before the checkout timer expires. Seats are confirmed only after PayHere verifies payment.",
    chooseSeats: "Choose your seats", stage: "STAGE", swipe: "Swipe horizontally to explore the complete seating plan", left: "Left wing", right: "Right wing", block: "Block", row: "Row", seat: "Seat",
    available: "Available", selected: "Selected", reserved: "Tentative", booked: "Booked", selection: "Your selection", emptySelection: "Choose one or more coloured seats from the map.", maxSeats: "Maximum 8 seats per reservation.", seats: "seats", total: "Total", continue: "Continue to details", clear: "Clear selection",
    accountTitle: "Google account", signedOut: "Sign in before continuing to secure payment", signedInAs: "Signed in as", signInGoogle: "Sign in with Google", signOut: "Sign out", signingIn: "Please wait…",
    help: "Need help?", directions: "Open booking location", call: "Call", staff: "Staff portal", detailsTitle: "Checkout details", detailsIntro: "Confirm the billing details required by PayHere, then continue to its secure payment page.", fullName: "Full name", contact: "Sri Lankan contact number", address: "Billing address", city: "City", optionalId: "NIC / ID number (optional)", privacy: "Your verified Google email will receive the payment receipt. Card details are entered only on PayHere.", consent: "I agree that these details may be used to process this booking and send its receipt.", cancel: "Cancel", reserveNow: "Continue to PayHere", reserving: "Creating secure checkout…",
    invalidName: "Enter a name between 2 and 80 characters.", invalidContact: "Enter a valid Sri Lankan phone number.", invalidAddress: "Enter a billing address between 5 and 160 characters.", invalidCity: "Enter a city between 2 and 80 characters.", invalidId: "The ID number is too long.", unavailable: "One or more selected seats were just taken. The map has been refreshed.", limit: "You can select up to 8 seats.", genericError: "The reservation could not be completed. Please try again.",
    successTitle: "Payment confirmed", successBody: "Your seats are confirmed and a receipt has been queued for your Google email address.", reference: "Reservation reference", show: "Show", deadline: "Paid", copyReference: "Copy reference", copied: "Reference copied", close: "Close",
  },
  si: {
    kicker: "නාට්‍ය ආසන වෙන්කිරීම්", title: "ගරු කතානායකතුමනි", eventDate: "2026 සැප්තැම්බර් 3", venue: "සියුස් ශාලාව", school: "ලයිසියම් ජාත්‍යන්තර පාසල ගම්පහ",
    loading: "ආසන තත්ත්වය ලබා ගනිමින්…", live: "සජීවී ආසන තත්ත්වය", loadError: "ආසන තත්ත්වය ලබාගත නොහැක. සම්බන්ධතාව පරීක්ෂා කරන්න.",
    guideTitle: "පියවර තුනකින් ආසන වෙන්කරන්න", guideText: "දර්ශනය තෝරා, ආසන 8ක් දක්වා තෝරා, ඔබේ සම්බන්ධතා විස්තර එක් වරක් ඇතුළත් කරන්න.", chooseShow: "දර්ශන වේලාව තෝරන්න", afternoonShow: "සවස දර්ශනය", eveningShow: "රාත්‍රී දර්ශනය", availableCount: "ලබා ගත හැක", soldCount: "අලෙවි වී ඇත", totalSold: "දර්ශන දෙකෙහි අලෙවි වූ ප්‍රවේශපත්", soldByBlock: "කොටස අනුව තහවුරු කළ ප්‍රවේශපත් අලෙවිය",
    holdTitle: "ආරක්ෂිත ගෙවීම සඳහා ආසන මිනිත්තු 15ක් රඳවා තැබේ", holdText: "Google ගිණුමෙන් පිවිසී නියමිත කාලය තුළ PayHere ගෙවීම සම්පූර්ණ කරන්න. ගෙවීම තහවුරු වූ පසු පමණක් ආසන වෙන් වේ.",
    chooseSeats: "ආසන තෝරන්න", stage: "වේදිකාව", swipe: "සම්පූර්ණ ආසන සැලැස්ම බැලීමට පසෙකට ස්වයිප් කරන්න", left: "වම් පස", right: "දකුණු පස", block: "කොටස", row: "පේළිය", seat: "ආසනය",
    available: "ලබා ගත හැක", selected: "තෝරා ඇත", reserved: "තාවකාලික", booked: "වෙන් කර ඇත", selection: "ඔබේ තේරීම", emptySelection: "සැලැස්මෙන් වර්ණවත් ආසන තෝරන්න.", maxSeats: "එක් වෙන්කිරීමකට උපරිම ආසන 8කි.", seats: "ආසන", total: "මුළු මුදල", continue: "විස්තර ඇතුළත් කරන්න", clear: "තේරීම ඉවත් කරන්න",
    accountTitle: "Google ගිණුම", signedOut: "ආරක්ෂිත ගෙවීමට පෙර Google ගිණුමෙන් පිවිසෙන්න", signedInAs: "පිවිසී ඇති ගිණුම", signInGoogle: "Google සමඟ පිවිසෙන්න", signOut: "ඉවත් වන්න", signingIn: "මොහොතක් රැඳී සිටින්න…",
    help: "උදව් අවශ්‍යද?", directions: "වෙන්කිරීමේ ස්ථානය බලන්න", call: "අමතන්න", staff: "කාර්ය මණ්ඩල පිවිසුම", detailsTitle: "ගෙවීම් විස්තර", detailsIntro: "PayHere සඳහා අවශ්‍ය බිල්පත් විස්තර තහවුරු කර ආරක්ෂිත ගෙවීම් පිටුවට යන්න.", fullName: "සම්පූර්ණ නම", contact: "ශ්‍රී ලංකා දුරකථන අංකය", address: "බිල්පත් ලිපිනය", city: "නගරය", optionalId: "ජා.හැ. / හැඳුනුම්පත් අංකය (අවශ්‍ය නම්)", privacy: "රිසිට්පත Google ඊමේල් ලිපිනයට යවනු ලැබේ. කාඩ්පත් විස්තර ඇතුළත් කරන්නේ PayHere වෙත පමණි.", consent: "වෙන්කිරීම හා රිසිට්පත සඳහා මෙම විස්තර භාවිතයට එකඟ වෙමි.", cancel: "අවලංගු කරන්න", reserveNow: "PayHere වෙත යන්න", reserving: "ගෙවීම් සැසිය සකස් කරමින්…",
    invalidName: "අක්ෂර 2ත් 80ත් අතර නමක් ඇතුළත් කරන්න.", invalidContact: "වලංගු ශ්‍රී ලංකා දුරකථන අංකයක් ඇතුළත් කරන්න.", invalidAddress: "වලංගු බිල්පත් ලිපිනයක් ඇතුළත් කරන්න.", invalidCity: "වලංගු නගරයක් ඇතුළත් කරන්න.", invalidId: "හැඳුනුම්පත් අංකය දිග වැඩියි.", unavailable: "තෝරාගත් ආසන කිහිපයක් වෙනත් අයෙකු වෙන්කර ඇත. සැලැස්ම යාවත්කාලීන කර ඇත.", limit: "ආසන 8ක් දක්වා තෝරා ගත හැක.", genericError: "වෙන්කිරීම සම්පූර්ණ කළ නොහැක. නැවත උත්සාහ කරන්න.",
    successTitle: "ගෙවීම තහවුරු විය", successBody: "ඔබගේ ආසන තහවුරු කර ඇති අතර රිසිට්පත Google ඊමේල් ලිපිනයට යවනු ලැබේ.", reference: "වෙන්කිරීමේ යොමු අංකය", show: "දර්ශනය", deadline: "ගෙවූ වේලාව", copyReference: "යොමු අංකය පිටපත් කරන්න", copied: "යොමු අංකය පිටපත් විය", close: "වසන්න",
  },
};

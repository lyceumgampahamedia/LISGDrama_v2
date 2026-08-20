import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase.js";

export const createPaymentSession = httpsCallable(functions, "createPaymentSession");
export const getPaymentStatus = httpsCallable(functions, "getPaymentStatus");
export const cancelPaymentSession = httpsCallable(functions, "cancelPaymentSession");
export const confirmPayment = httpsCallable(functions, "confirmPayment");
export const cancelReservation = httpsCallable(functions, "cancelReservation");
export const createConfirmedReservation = httpsCallable(functions, "createConfirmedReservation");

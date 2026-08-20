import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { SHOWS } from "../config.js";
import { db } from "../services/firebase.js";

const emptyRecords = Object.freeze(
  Object.fromEntries(Object.keys(SHOWS).map((showId) => [showId, new Map()])),
);

export default function useShowSeatRecords(enabled = true) {
  const [recordsByShow, setRecordsByShow] = useState(emptyRecords);
  const [connectionByShow, setConnectionByShow] = useState(
    Object.fromEntries(Object.keys(SHOWS).map((showId) => [showId, "loading"])),
  );

  useEffect(() => {
    if (!enabled) return undefined;

    setConnectionByShow(Object.fromEntries(Object.keys(SHOWS).map((showId) => [showId, "loading"])));
    const unsubscribes = Object.keys(SHOWS).map((showId) => onSnapshot(
      collection(db, "shows", showId, "seats"),
      (snapshot) => {
        const nextRecords = new Map(snapshot.docs.map((document) => [document.id, document.data()]));
        setRecordsByShow((current) => ({ ...current, [showId]: nextRecords }));
        setConnectionByShow((current) => ({ ...current, [showId]: "live" }));
      },
      () => setConnectionByShow((current) => ({ ...current, [showId]: "error" })),
    ));

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [enabled]);

  const states = Object.values(connectionByShow);
  const connection = states.includes("error") ? "error" : states.every((state) => state === "live") ? "live" : "loading";
  return { recordsByShow, connection, connectionByShow };
}

const env = import.meta.env;
const hostingDomain = typeof window !== "undefined"
  && env.VITE_FIREBASE_PROJECT_ID
  && window.location.hostname === `${env.VITE_FIREBASE_PROJECT_ID}.web.app`
  ? window.location.hostname
  : env.VITE_FIREBASE_AUTH_DOMAIN;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: hostingDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const configured = Boolean(config.apiKey);

let appPromise;
let authServicesPromise;
let firestoreServicesPromise;

const getApp = () => {
  if (!configured) return Promise.reject(new Error("Firebase is not configured"));
  if (!appPromise) {
    appPromise = import("firebase/app").then(({ getApp: getExistingApp, getApps, initializeApp }) =>
      getApps().length ? getExistingApp() : initializeApp(config),
    );
  }
  return appPromise;
};

const getAuthServices = () => {
  if (!authServicesPromise) {
    authServicesPromise = Promise.all([getApp(), import("firebase/auth")]).then(([app, auth]) => ({
      auth: auth.getAuth(app),
      ...auth,
    }));
  }
  return authServicesPromise;
};

const getFirestoreServices = () => {
  if (!firestoreServicesPromise) {
    firestoreServicesPromise = Promise.all([getApp(), import("firebase/firestore")]).then(([app, firestore]) => ({
      db: firestore.getFirestore(app),
      ...firestore,
    }));
  }
  return firestoreServicesPromise;
};

export const onUser = (callback) => {
  if (!configured) {
    callback(null);
    return () => {};
  }
  let active = true;
  let unsubscribe = () => {};
  getAuthServices()
    .then(({ auth, onAuthStateChanged }) => {
      if (active) unsubscribe = onAuthStateChanged(auth, callback);
    })
    .catch(() => {
      if (active) callback(null);
    });
  return () => {
    active = false;
    unsubscribe();
  };
};

export const signUp = async (email, password) => {
  const { auth, createUserWithEmailAndPassword } = await getAuthServices();
  return createUserWithEmailAndPassword(auth, email, password);
};

export const signIn = async (email, password) => {
  const { auth, signInWithEmailAndPassword } = await getAuthServices();
  return signInWithEmailAndPassword(auth, email, password);
};

const isMobileBrowser = () => typeof navigator !== "undefined" && (
  /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent)
  || navigator.maxTouchPoints > 1
  || (typeof window !== "undefined" && (
    window.matchMedia?.("(pointer: coarse)").matches
    || window.matchMedia?.("(max-width: 768px)").matches
  ))
);

export const google = async () => {
  const { auth, GoogleAuthProvider, signInWithCredential, signInWithPopup, signInWithRedirect } = await getAuthServices();
  const provider = new GoogleAuthProvider();
  if (window.wavelengthDesktop?.googleSignIn) {
    const { idToken } = await window.wavelengthDesktop.googleSignIn();
    return signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  }
  if (isMobileBrowser()) return signInWithRedirect(auth, provider);
  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    if (error.code === "auth/popup-blocked") return signInWithRedirect(auth, provider);
    throw error;
  }
};

export const googleRedirectResult = async () => {
  if (!configured) return null;
  const { auth, GoogleAuthProvider, getRedirectResult, signInWithRedirect } = await getAuthServices();
  const desktopState = new URLSearchParams(window.location.search).get("desktopAuth");
  if (!desktopState) return getRedirectResult(auth);

  const result = await getRedirectResult(auth);
  if (!result) return signInWithRedirect(auth, new GoogleAuthProvider());

  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.idToken) throw new Error("Google did not return an ID token");
  const callback = new URL("wavelength://auth/callback");
  callback.searchParams.set("state", desktopState);
  callback.searchParams.set("idToken", credential.idToken);
  window.location.replace(callback.href);
  return null;
};

export const logout = async () => {
  const { auth, signOut } = await getAuthServices();
  return signOut(auth);
};

export const loadData = async (uid) => {
  const { db, doc, getDoc } = await getFirestoreServices();
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? snapshot.data() : null;
};

export const saveData = async (uid, data) => {
  const { db, doc, setDoc } = await getFirestoreServices();
  return setDoc(doc(db, "users", uid), data, { merge: true });
};

export const newSharedPlaylistId = async () => {
  const { db, collection, doc } = await getFirestoreServices();
  return doc(collection(db, "sharedPlaylists")).id;
};

export const saveSharedPlaylist = async (id, data) => {
  const { db, doc, setDoc } = await getFirestoreServices();
  return setDoc(doc(db, "sharedPlaylists", id), data);
};

export const deleteSharedPlaylist = async (id) => {
  const { db, doc, deleteDoc } = await getFirestoreServices();
  return deleteDoc(doc(db, "sharedPlaylists", id));
};

export const loadSharedPlaylist = async (id) => {
  const { db, doc, getDoc } = await getFirestoreServices();
  const snapshot = await getDoc(doc(db, "sharedPlaylists", id));
  if (!snapshot.exists() || snapshot.data().isPublic !== true) return null;
  const { name, description, cover, tracks, localTrackCount, updatedAt } = snapshot.data();
  return { name, description, cover, tracks, localTrackCount, updatedAt };
};

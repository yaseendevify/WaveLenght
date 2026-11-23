import {initializeApp} from 'firebase/app'
import {getAuth,GoogleAuthProvider,signInWithPopup,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,onAuthStateChanged} from 'firebase/auth'
import {getFirestore,doc,getDoc,setDoc} from 'firebase/firestore'
const e=import.meta.env
const cfg={apiKey:e.VITE_FIREBASE_API_KEY,authDomain:e.VITE_FIREBASE_AUTH_DOMAIN,projectId:e.VITE_FIREBASE_PROJECT_ID,appId:e.VITE_FIREBASE_APP_ID}
export const configured=!!cfg.apiKey
const app=configured?initializeApp(cfg):null
const auth=app&&getAuth(app),fs=app&&getFirestore(app)
export const onUser=cb=>auth?onAuthStateChanged(auth,cb):(cb(null),()=>{})
export const signUp=(m,p)=>createUserWithEmailAndPassword(auth,m,p)
export const signIn=(m,p)=>signInWithEmailAndPassword(auth,m,p)
export const google=()=>signInWithPopup(auth,new GoogleAuthProvider())
export const logout=()=>signOut(auth)
export const loadData=async uid=>{const s=await getDoc(doc(fs,'users',uid));return s.exists()?s.data():null}
export const saveData=(uid,d)=>setDoc(doc(fs,'users',uid),d,{merge:true})

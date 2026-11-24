import {initializeApp} from 'firebase/app'
import {getAuth,GoogleAuthProvider,signInWithPopup,signInWithRedirect,getRedirectResult,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,onAuthStateChanged} from 'firebase/auth'
import {getFirestore,doc,getDoc,setDoc,deleteDoc,collection} from 'firebase/firestore'
const e=import.meta.env
const cfg={apiKey:e.VITE_FIREBASE_API_KEY,authDomain:e.VITE_FIREBASE_AUTH_DOMAIN,projectId:e.VITE_FIREBASE_PROJECT_ID,appId:e.VITE_FIREBASE_APP_ID}
export const configured=!!cfg.apiKey
const app=configured?initializeApp(cfg):null
const auth=app&&getAuth(app),fs=app&&getFirestore(app)
export const onUser=cb=>auth?onAuthStateChanged(auth,cb):(cb(null),()=>{})
export const signUp=(m,p)=>createUserWithEmailAndPassword(auth,m,p)
export const signIn=(m,p)=>signInWithEmailAndPassword(auth,m,p)
const isMobileBrowser=()=>typeof navigator!=="undefined"&&(
  /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent)||
  navigator.maxTouchPoints>1||
  (typeof window!=="undefined"&&(window.matchMedia?.("(pointer: coarse)").matches||window.matchMedia?.("(max-width: 768px)").matches))
)
export const google=async()=>{
  const provider=new GoogleAuthProvider()
  if(isMobileBrowser()) return signInWithRedirect(auth,provider)
  try{return await signInWithPopup(auth,provider)}
  catch(error){if(error.code==="auth/popup-blocked") return signInWithRedirect(auth,provider);throw error}
}
export const googleRedirectResult=()=>auth?getRedirectResult(auth):Promise.resolve(null)
export const logout=()=>signOut(auth)
export const loadData=async uid=>{const s=await getDoc(doc(fs,'users',uid));return s.exists()?s.data():null}
export const saveData=(uid,d)=>setDoc(doc(fs,'users',uid),d,{merge:true})
export const newSharedPlaylistId=()=>doc(collection(fs,'sharedPlaylists')).id
export const saveSharedPlaylist=(id,data)=>setDoc(doc(fs,'sharedPlaylists',id),data)
export const deleteSharedPlaylist=id=>deleteDoc(doc(fs,'sharedPlaylists',id))
export const loadSharedPlaylist=async id=>{
  const snapshot=await getDoc(doc(fs,'sharedPlaylists',id))
  if(!snapshot.exists()||snapshot.data().isPublic!==true)return null
  const {name,description,cover,tracks,localTrackCount,updatedAt}=snapshot.data()
  return {name,description,cover,tracks,localTrackCount,updatedAt}
}

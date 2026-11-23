let db
const open=()=>db?Promise.resolve(db):new Promise(r=>{try{const q=indexedDB.open('wl-files',1);q.onupgradeneeded=()=>q.result.createObjectStore('f',{keyPath:'id'});q.onsuccess=()=>r(db=q.result);q.onerror=()=>r(null)}catch{r(null)}})
const run=async(m,fn)=>{const d=await open();return new Promise(r=>{if(!d)return r(null);try{const q=fn(d.transaction('f',m).objectStore('f'));q.onsuccess=()=>r(q.result??true);q.onerror=()=>r(null)}catch{r(null)}})}
export const putFile=o=>run('readwrite',s=>s.put(o))
export const getFile=id=>run('readonly',s=>s.get(id))
export const delFile=id=>run('readwrite',s=>s.delete(id))
export const allFiles=()=>run('readonly',s=>s.getAll())

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("wavelengthDesktop", {
  googleSignIn: () => new Promise((resolve, reject) => {
    const finish = (_event, result) => {
      ipcRenderer.removeListener("wavelength:google-result", finish);
      if (result.error) reject(new Error(result.error));
      else resolve({ idToken: result.idToken });
    };
    ipcRenderer.on("wavelength:google-result", finish);
    ipcRenderer.invoke("wavelength:google-start").catch((error) => {
      ipcRenderer.removeListener("wavelength:google-result", finish);
      reject(error);
    });
  }),
});

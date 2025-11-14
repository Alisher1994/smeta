// Minimal Google Drive integration using Google Identity Services
// NOTE: You must replace CLIENT_ID below with your OAuth 2.0 Web client ID
// from https://console.cloud.google.com/apis/credentials and enable the Drive API.

(function(){
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const API_BASE = 'https://www.googleapis.com/drive/v3';
  const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const APP_FOLDER_NAME = 'SMETA_APP';

  const state = {
    clientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
    accessToken: null,
    tokenExpiry: 0,
    appFolderId: null
  };

  function setClientId(clientId){ state.clientId = clientId; }

  function now(){ return Math.floor(Date.now()/1000); }

  function restoreToken(){
    try{
      const s = JSON.parse(localStorage.getItem('drive_token')||'null');
      if (s && s.accessToken && s.tokenExpiry && s.tokenExpiry > now()+30){
        state.accessToken = s.accessToken; state.tokenExpiry = s.tokenExpiry; return true;
      }
    }catch(_){}
    return false;
  }
  function persistToken(){
    try{ localStorage.setItem('drive_token', JSON.stringify({accessToken: state.accessToken, tokenExpiry: state.tokenExpiry})); }catch(_){ }
  }

  function isAuthorized(){
    return !!state.accessToken && state.tokenExpiry > now()+30;
  }

  function signIn(){
    return new Promise((resolve, reject)=>{
      const ensure = () => {
        if (isAuthorized()) return resolve(true);
        if (!google || !google.accounts || !google.accounts.oauth2) return reject(new Error('Google Identity not loaded'));
        const tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: state.clientId,
          scope: SCOPE,
          callback: (resp) => {
            if (resp && resp.access_token){
              state.accessToken = resp.access_token;
              // GIS does not give expires_in here reliably; assume 55 minutes
              state.tokenExpiry = now() + 55*60;
              persistToken();
              resolve(true);
            } else {
              reject(new Error('No access token'));
            }
          }
        });
        tokenClient.requestAccessToken({ prompt: 'consent' });
      };
      if (!restoreToken()) ensure(); else resolve(true);
    });
  }

  function authHeader(){ return { 'Authorization': 'Bearer ' + state.accessToken }; }

  async function ensureAppFolder(){
    if (state.appFolderId) return state.appFolderId;
    // find folder by name
    const q = encodeURIComponent("name='"+APP_FOLDER_NAME+"' and mimeType='application/vnd.google-apps.folder' and trashed=false");
    const res = await fetch(API_BASE + '/files?q=' + q + '&fields=files(id,name)', { headers: authHeader() });
    if (!res.ok) throw new Error('Drive search failed');
    const data = await res.json();
    if (data.files && data.files.length){ state.appFolderId = data.files[0].id; return state.appFolderId; }
    // create
    const meta = { name: APP_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' };
    const created = await fetch(API_BASE + '/files', {
      method: 'POST', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify(meta)
    });
    if (!created.ok) throw new Error('Drive create folder failed');
    const jf = await created.json();
    state.appFolderId = jf.id; return jf.id;
  }

  async function findFileByName(name){
    const folderId = await ensureAppFolder();
    const q = encodeURIComponent("name='"+name+"' and '"+folderId+"' in parents and trashed=false");
    const res = await fetch(API_BASE + '/files?q=' + q + '&fields=files(id,name)', { headers: authHeader() });
    if (!res.ok) throw new Error('Drive search failed');
    const data = await res.json();
    return (data.files && data.files[0]) || null;
  }

  function multipartBody(metadata, blob){
    const boundary = '-------smeta-' + Math.random().toString(16).slice(2);
    const metaPart = new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' });
    const body = new FormData();
    // FormData with multipart/related is tricky; use manual body string for reliability
    return {
      boundary,
      body: new Blob([
        `--${boundary}\r\n`,
        'Content-Type: application/json; charset=UTF-8\r\n\r\n',
        JSON.stringify(metadata), '\r\n',
        `--${boundary}\r\n`,
        `Content-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`,
        blob, '\r\n',
        `--${boundary}--`
      ], { type: 'multipart/related; boundary=' + boundary })
    };
  }

  async function createOrUpdateFile(name, blob, mime){
    const folderId = await ensureAppFolder();
    const existing = await findFileByName(name).catch(()=>null);
    const metadata = { name, parents: [folderId] };
    const { boundary, body } = multipartBody(metadata, blob);
    if (existing){
      const res = await fetch(UPLOAD_URL + '&fields=id', { method: 'PATCH', headers: { ...authHeader(), 'Content-Type': 'multipart/related; boundary=' + boundary }, body });
      if (!res.ok) throw new Error('Drive update failed');
      return (await res.json()).id;
    } else {
      const res = await fetch(UPLOAD_URL + '&fields=id', { method: 'POST', headers: { ...authHeader(), 'Content-Type': 'multipart/related; boundary=' + boundary }, body });
      if (!res.ok) throw new Error('Drive create failed');
      return (await res.json()).id;
    }
  }

  async function saveProject(project){
    if (!isAuthorized()) throw new Error('Not authorized');
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    return await createOrUpdateFile('current_object.json', blob, 'application/json');
  }

  async function loadProject(){
    if (!isAuthorized()) throw new Error('Not authorized');
    const file = await findFileByName('current_object.json');
    if (!file) return null;
    const res = await fetch(API_BASE + '/files/' + file.id + '?alt=media', { headers: authHeader() });
    if (!res.ok) throw new Error('Drive download failed');
    return await res.json();
  }

  function signOut(){ state.accessToken = null; state.tokenExpiry = 0; localStorage.removeItem('drive_token'); }

  window.DriveAPI = { setClientId, signIn, signOut, isAuthorized, saveProject, loadProject };
})();

# Sprint A7 — PDF Download + Native Share Sheet

## Goal
Doctors can download or share the SOAP note PDF, prescription PDF, and patient sheet from within the app using the native Android share sheet. One tap — WhatsApp, email, print, Drive.

## The Problem
On web, `window.open(pdfUrl)` opens a new tab. On Android WebView, this either fails or opens the browser. We need to download the PDF to device storage and trigger the native share dialog.

## Scope

### 1. `@capacitor/filesystem` + `@capacitor/share`
- `npm install @capacitor/filesystem @capacitor/share`
- Download PDF from backend as blob
- Write to `Documents/Chartr/` folder on device
- Trigger native share sheet with the file URI

### 2. PDF action flow
```
User taps "Download PDF"
  → api.get('/api/notes/{id}/pdf', { responseType: 'blob' })
  → Write to device: Chartr/note_{id}_{date}.pdf
  → Share.share({ title: 'SOAP Note', url: fileUri })
  → Native sheet: WhatsApp / Email / Print / Drive / etc.
```

### 3. Platform switch
```js
if (Capacitor.isNativePlatform()) {
  // native download + share
} else {
  // existing window.open() / anchor download
}
```

### 4. Android permissions
- `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` — added to manifest
- Runtime request on first PDF action

### 5. PDF types supported
- SOAP Note PDF
- Prescription PDF  
- Patient Instruction Sheet PDF
- All three use the same download+share pattern

### 6. Progress indicator
- Spinner on the download button while fetching
- "Saved to device" toast on success
- Error toast if download fails (network issue)

## Out of Scope
- Print directly from app (share sheet includes system print option)
- PDF annotation/signing

## Done When
- [ ] Tap PDF button → spinner → native share sheet opens
- [ ] File saved to Documents/Chartr/ on device
- [ ] Can WhatsApp/email the PDF directly from share sheet
- [ ] Web PDF download still works via browser anchor download
- [ ] Works for all 3 PDF types

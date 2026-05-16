// nativeShare.js
// On Android native: saves PDF to app cache dir, opens system share sheet.
// On web: falls back to browser <a download> click.

import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

const isNative = Capacitor.isNativePlatform()

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function webDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function sharePdf(blob, filename) {
  if (!isNative) {
    webDownload(blob, filename)
    return
  }

  const base64 = await blobToBase64(blob)

  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
  })

  await Share.share({
    title: filename,
    url: uri,
    dialogTitle: 'Share or save PDF',
  })
}

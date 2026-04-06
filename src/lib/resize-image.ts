export function resizeImage(file: File, maxSize = 800): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const canvas = document.createElement('canvas')
      let { width, height } = img
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width)
          width = maxSize
        } else {
          width = Math.round((width * maxSize) / height)
          height = maxSize
        }
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Error al procesar imagen'))),
        'image/jpeg',
        0.85
      )
    }
    const objectUrl = URL.createObjectURL(file)
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Error al leer imagen')) }
    img.src = objectUrl
  })
}

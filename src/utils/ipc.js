// Clean wrapper around window.electronAPI
const api = () => window.electronAPI

export const getPathForFile = (file) => api().getPathForFile(file)
export const processImages = (payload) => api().processImages(payload)
export const onProgress = (callback) => api().onProgress(callback)
export const generateThumbnail = (filePath) => api().generateThumbnail(filePath)
export const generatePreview = (filePath, maxWidth) => api().generatePreview(filePath, maxWidth)
export const saveFolder = () => api().saveFolder()
export const openFolder = (folderPath) => api().openFolder(folderPath)
export const storeGet = (key) => api().storeGet(key)
export const storeSet = (key, value) => api().storeSet(key, value)
export const saveLogo = (base64, originalPath) => api().saveLogo(base64, originalPath)
export const readLogo = () => api().readLogo()

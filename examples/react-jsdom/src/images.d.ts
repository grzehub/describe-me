/** Vite turns an image import into its URL. */
declare module '*.jpg' {
  const url: string

  export default url
}

import landscape from './assets/landscape.jpg'
import './assets/fonts/fonts.css'
import './styles.css'
import './postcard.css'

export interface PostcardProps {
  /** Where the postcard is from, printed under the photo. */
  place: string
}

/**
 * A photo imported as a module, a stamp-edge background from a stylesheet
 * `url()` and a caption font from an imported `fonts.css`: project files the
 * viewer has to serve long after the tests ran.
 */
export function Postcard({ place }: PostcardProps) {
  return (
    <figure className="postcard">
      <img
        className="postcard-photo"
        src={landscape}
        alt={`Hills near ${place}`}
        width={480}
        height={270}
      />
      <figcaption className="postcard-caption">Greetings from {place}</figcaption>
    </figure>
  )
}

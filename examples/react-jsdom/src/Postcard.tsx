import landscape from './assets/landscape.jpg'
import './styles.css'
import './postcard.css'

export interface PostcardProps {
  /** Where the postcard is from, printed under the photo. */
  place: string
}

/**
 * A photo imported as a module and a stamp-edge background from a stylesheet
 * `url()`: two project files the viewer has to serve long after the tests ran.
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

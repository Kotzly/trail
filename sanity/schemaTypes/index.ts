// Objects
import {seo} from './objects/seo'
import {link} from './objects/link'
import {ctaBlock} from './objects/ctaBlock'

// Documents
import {landingPage} from './documents/landingPage'
import {siteSettings} from './documents/siteSettings'
import {supportPage} from './documents/supportPage'

// Sections
import {heroSection} from './sections/heroSection'
import {bentoFeaturesSection} from './sections/bentoFeaturesSection'
import {ctaSection} from './sections/ctaSection'

export const schemaTypes = [
  seo,
  link,
  ctaBlock,

  heroSection,
  bentoFeaturesSection,
  ctaSection,

  landingPage,
  siteSettings,
  supportPage,
]

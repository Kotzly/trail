// Objects
import {seo} from './objects/seo'
import {link} from './objects/link'
import {ctaBlock} from './objects/ctaBlock'

// Documents
import {page} from './documents/page'
import {landingPage} from './documents/landingPage'
import {siteSettings} from './documents/siteSettings'
import {legalPage} from './documents/legalPage'

// Sections
import {heroSection} from './sections/heroSection'
import {trustedBySection} from './sections/trustedBySection'
import {bentoFeaturesSection} from './sections/bentoFeaturesSection'
import {videoShowcasesSection} from './sections/videoShowcasesSection'
import {faqSection} from './sections/faqSection'
import {ctaSection} from './sections/ctaSection'
import {testimonialsSection} from './sections/testimonialsSection'
import {pricingSection} from './sections/pricingSection'
import {statsSection} from './sections/statsSection'
import {valuesSection} from './sections/valuesSection'
import {storySection} from './sections/storySection'
import {contactMethodsSection} from './sections/contactMethodsSection'
import {contactFormSection} from './sections/contactFormSection'
import {browserCardsSection} from './sections/browserCardsSection'
import {onboardingStepsSection} from './sections/onboardingStepsSection'
import {featuresGridSection} from './sections/featuresGridSection'
import {timelineSection} from './sections/timelineSection'
import {supportOptionsSection} from './sections/supportOptionsSection'
import {quickLinksSection} from './sections/quickLinksSection'
import {comparisonTableSection} from './sections/comparisonTableSection'
import {infoColumnsSection} from './sections/infoColumnsSection'
import {supportFlowSection} from './sections/supportFlowSection'
import {pageHeaderSection} from './sections/pageHeaderSection'
import {simpleCtaSection} from './sections/simpleCtaSection'

export const schemaTypes = [
  // Objects (must be registered before types that reference them)
  seo,
  link,
  ctaBlock,

  // Sections (must be registered before page which references them)
  heroSection,
  trustedBySection,
  bentoFeaturesSection,
  videoShowcasesSection,
  faqSection,
  ctaSection,
  testimonialsSection,
  pricingSection,
  statsSection,
  valuesSection,
  storySection,
  contactMethodsSection,
  contactFormSection,
  browserCardsSection,
  onboardingStepsSection,
  featuresGridSection,
  timelineSection,
  supportOptionsSection,
  quickLinksSection,
  comparisonTableSection,
  infoColumnsSection,
  supportFlowSection,
  pageHeaderSection,
  simpleCtaSection,

  // Documents
  page,
  landingPage,
  siteSettings,
  legalPage,
]

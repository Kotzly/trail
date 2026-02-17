import {defineField, defineType} from 'sanity'
import {DocumentTextIcon} from '@sanity/icons'

export const page = defineType({
  name: 'page',
  title: 'Page',
  type: 'document',
  icon: DocumentTextIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {source: 'title', maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'seo',
      title: 'SEO',
      type: 'seo',
    }),
    defineField({
      name: 'sections',
      title: 'Sections',
      type: 'array',
      of: [
        {type: 'heroSection'},
        {type: 'trustedBySection'},
        {type: 'bentoFeaturesSection'},
        {type: 'videoShowcasesSection'},
        {type: 'faqSection'},
        {type: 'ctaSection'},
        {type: 'testimonialsSection'},
        {type: 'pricingSection'},
        {type: 'statsSection'},
        {type: 'valuesSection'},
        {type: 'storySection'},
        {type: 'contactMethodsSection'},
        {type: 'contactFormSection'},
        {type: 'browserCardsSection'},
        {type: 'onboardingStepsSection'},
        {type: 'featuresGridSection'},
        {type: 'timelineSection'},
        {type: 'supportOptionsSection'},
      ],
    }),
  ],
  preview: {
    select: {title: 'title', slug: 'slug.current'},
    prepare({title, slug}) {
      return {title, subtitle: `/${slug ?? ''}`}
    },
  },
})

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
        {type: 'pageHeaderSection'},
        {type: 'simpleCtaSection'},
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
        {type: 'quickLinksSection'},
        {type: 'comparisonTableSection'},
        {type: 'infoColumnsSection'},
        {type: 'supportFlowSection'},
        {type: 'faqSection'},
        {type: 'pricingSection'},
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

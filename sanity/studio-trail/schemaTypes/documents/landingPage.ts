import {defineField, defineType} from 'sanity'
import {StarIcon} from '@sanity/icons'

export const landingPage = defineType({
  name: 'landingPage',
  title: 'Landing Page',
  type: 'document',
  icon: StarIcon,
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
        {type: 'ctaSection'},
        {type: 'testimonialsSection'},
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

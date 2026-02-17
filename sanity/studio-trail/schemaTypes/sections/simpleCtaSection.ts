import {defineField, defineType} from 'sanity'
import {LaunchIcon} from '@sanity/icons'

export const simpleCtaSection = defineType({
  name: 'simpleCtaSection',
  title: 'Simple CTA',
  type: 'object',
  icon: LaunchIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'description', title: 'Description', type: 'text', rows: 3}),
    defineField({name: 'primaryCta', title: 'Primary CTA', type: 'ctaBlock'}),
    defineField({name: 'secondaryCta', title: 'Secondary CTA', type: 'ctaBlock'}),
  ],
  preview: {
    select: {title: 'title'},
    prepare({title}) {
      return {title: title || 'Simple CTA'}
    },
  },
})

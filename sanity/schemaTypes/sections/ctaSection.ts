import {defineField, defineType} from 'sanity'
import {RocketIcon} from '@sanity/icons'

export const ctaSection = defineType({
  name: 'ctaSection',
  title: 'Call to Action',
  type: 'object',
  icon: RocketIcon,
  fields: [
    defineField({name: 'eyebrow', title: 'Eyebrow', type: 'string'}),
    defineField({name: 'title', title: 'Title', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'rotatingWords',
      title: 'Rotating Words',
      type: 'array',
      of: [{type: 'string'}],
      description: 'Animated words that cycle after the title',
    }),
    defineField({name: 'description', title: 'Description', type: 'text', rows: 3}),
    defineField({name: 'primaryCta', title: 'Primary CTA', type: 'ctaBlock'}),
    defineField({name: 'secondaryCta', title: 'Secondary CTA', type: 'ctaBlock'}),
    defineField({name: 'note', title: 'Note', type: 'string', description: 'Small text below buttons'}),
  ],
  preview: {
    select: {title: 'title', eyebrow: 'eyebrow'},
    prepare({title, eyebrow}) {
      return {title: title || 'CTA', subtitle: eyebrow}
    },
  },
})

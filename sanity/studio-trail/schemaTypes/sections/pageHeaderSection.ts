import {defineField, defineType} from 'sanity'
import {BlockElementIcon} from '@sanity/icons'

export const pageHeaderSection = defineType({
  name: 'pageHeaderSection',
  title: 'Page Header',
  type: 'object',
  icon: BlockElementIcon,
  fields: [
    defineField({name: 'eyebrow', title: 'Eyebrow', type: 'string'}),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'description', title: 'Description', type: 'text', rows: 3}),
  ],
  preview: {
    select: {title: 'title', eyebrow: 'eyebrow'},
    prepare({title, eyebrow}) {
      return {title: title || 'Page Header', subtitle: eyebrow}
    },
  },
})

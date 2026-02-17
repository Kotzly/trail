import {defineField, defineType} from 'sanity'
import {UsersIcon} from '@sanity/icons'

export const trustedBySection = defineType({
  name: 'trustedBySection',
  title: 'Trusted By',
  type: 'object',
  icon: UsersIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      initialValue: 'Trusted by power users at',
    }),
    defineField({
      name: 'brands',
      title: 'Brands',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({name: 'name', title: 'Name', type: 'string', validation: (rule) => rule.required()}),
            defineField({name: 'logo', title: 'Logo', type: 'image', validation: (rule) => rule.required()}),
          ],
          preview: {
            select: {title: 'name', media: 'logo'},
          },
        },
      ],
    }),
  ],
  preview: {
    select: {title: 'title'},
    prepare({title}) {
      return {title: title || 'Trusted By'}
    },
  },
})

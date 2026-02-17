import {defineField, defineType} from 'sanity'
import {EditIcon} from '@sanity/icons'

export const contactFormSection = defineType({
  name: 'contactFormSection',
  title: 'Contact Form',
  type: 'object',
  icon: EditIcon,
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string', initialValue: 'Send us a message'}),
    defineField({name: 'description', title: 'Description', type: 'string'}),
    defineField({name: 'submitLabel', title: 'Submit Button Label', type: 'string', initialValue: 'Send Message'}),
    defineField({name: 'successTitle', title: 'Success Title', type: 'string', initialValue: 'Message sent!'}),
    defineField({name: 'successMessage', title: 'Success Message', type: 'string'}),
    defineField({
      name: 'subjects',
      title: 'Subject Options',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({name: 'label', title: 'Label', type: 'string'}),
            defineField({name: 'value', title: 'Value', type: 'string'}),
          ],
          preview: {select: {title: 'label'}},
        },
      ],
    }),
  ],
  preview: {
    select: {title: 'title'},
    prepare({title}) {
      return {title: title || 'Contact Form'}
    },
  },
})

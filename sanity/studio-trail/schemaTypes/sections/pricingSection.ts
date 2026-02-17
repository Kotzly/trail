import {defineField, defineType} from 'sanity'
import {CreditCardIcon} from '@sanity/icons'

export const pricingSection = defineType({
  name: 'pricingSection',
  title: 'Pricing',
  type: 'object',
  icon: CreditCardIcon,
  fields: [
    defineField({name: 'eyebrow', title: 'Eyebrow', type: 'string'}),
    defineField({name: 'title', title: 'Title', type: 'string', validation: (rule) => rule.required()}),
    defineField({name: 'description', title: 'Description', type: 'text', rows: 3}),
    defineField({name: 'toggleLabel', title: 'Toggle Label', type: 'string', initialValue: 'Annual billing'}),
    defineField({name: 'toggleNote', title: 'Toggle Note', type: 'string', initialValue: 'Save 20%'}),
    defineField({
      name: 'plans',
      title: 'Plans',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({name: 'name', title: 'Name', type: 'string', validation: (rule) => rule.required()}),
            defineField({name: 'price', title: 'Monthly Price', type: 'string'}),
            defineField({name: 'yearlyPrice', title: 'Yearly Price (per month)', type: 'string'}),
            defineField({name: 'period', title: 'Period Label', type: 'string', initialValue: 'per month'}),
            defineField({
              name: 'features',
              title: 'Features',
              type: 'array',
              of: [{type: 'string'}],
            }),
            defineField({name: 'description', title: 'Description', type: 'string'}),
            defineField({name: 'buttonText', title: 'Button Text', type: 'string'}),
            defineField({name: 'href', title: 'Button Link', type: 'string'}),
            defineField({name: 'isPopular', title: 'Popular badge', type: 'boolean', initialValue: false}),
          ],
          preview: {
            select: {title: 'name', subtitle: 'price'},
            prepare({title, subtitle}) {
              return {title, subtitle: subtitle ? `$${subtitle}/mo` : undefined}
            },
          },
        },
      ],
    }),
  ],
  preview: {
    select: {title: 'title', eyebrow: 'eyebrow'},
    prepare({title, eyebrow}) {
      return {title: title || 'Pricing', subtitle: eyebrow}
    },
  },
})

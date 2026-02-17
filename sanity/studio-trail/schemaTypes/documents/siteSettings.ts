import {defineField, defineType} from 'sanity'
import {CogIcon} from '@sanity/icons'

export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Site Settings',
  type: 'document',
  icon: CogIcon,
  fields: [
    defineField({
      name: 'siteName',
      title: 'Site Name',
      type: 'string',
      initialValue: 'Trail',
    }),
    defineField({
      name: 'siteUrl',
      title: 'Site URL',
      type: 'url',
    }),
    defineField({
      name: 'nav',
      title: 'Navigation',
      type: 'array',
      of: [{type: 'link'}],
    }),
    defineField({
      name: 'navCta',
      title: 'Navigation CTA Button',
      type: 'ctaBlock',
      description: 'The primary call-to-action button shown in the navigation bar',
    }),
    defineField({
      name: 'footerCopyright',
      title: 'Footer Copyright Text',
      type: 'string',
    }),
    defineField({
      name: 'footerLinks',
      title: 'Footer Links',
      type: 'array',
      of: [{type: 'link'}],
    }),
    defineField({
      name: 'supportEmail',
      title: 'Support Email',
      type: 'string',
    }),
    defineField({
      name: 'defaultSeo',
      title: 'Default SEO',
      type: 'seo',
      description: 'Fallback SEO values used when a page does not define its own',
    }),
  ],
  preview: {
    prepare() {
      return {title: 'Site Settings'}
    },
  },
})

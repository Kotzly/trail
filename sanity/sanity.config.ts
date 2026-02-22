import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import {CogIcon, StarIcon, HelpCircleIcon} from '@sanity/icons'
import type {StructureBuilder} from 'sanity/structure'

const singletonTypes = new Set(['siteSettings', 'landingPage', 'supportPage'])

function structure(S: StructureBuilder) {
  return S.list()
    .title('Content')
    .items([
      S.listItem()
        .title('Site Settings')
        .icon(CogIcon)
        .child(S.document().schemaType('siteSettings').documentId('siteSettings')),
      S.listItem()
        .title('Landing Page')
        .icon(StarIcon)
        .child(
          S.document()
            .schemaType('landingPage')
            .documentId('042dbb5a-4a60-4cde-8076-97f3e1293d36'),
        ),
      S.listItem()
        .title('Support Page')
        .icon(HelpCircleIcon)
        .child(
          S.document()
            .schemaType('supportPage')
            .documentId('f02432de-5376-4257-8019-488b3e442672'),
        ),
    ])
}

export default defineConfig({
  name: 'default',
  title: 'Trail',

  projectId: 'qejrh1jd',
  dataset: 'production',

  plugins: [
    structureTool({structure}),
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
    templates: (templates) => templates.filter(({schemaType}) => !singletonTypes.has(schemaType)),
  },

  document: {
    actions: (input, context) =>
      singletonTypes.has(context.schemaType)
        ? input.filter(({action}) => action && ['publish', 'discardChanges', 'restore'].includes(action))
        : input,
  },
})

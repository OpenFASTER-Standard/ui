import type { Meta, StoryObj } from "@storybook/react"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./accordion"

const meta: Meta<typeof Accordion> = {
  title: "UI/Accordion",
  component: Accordion,
}
export default meta
type Story = StoryObj<typeof Accordion>

export const Default: Story = {
  render: () => (
    <Accordion>
      <AccordionItem value="a">
        <AccordionTrigger>MiKaDiv_FM_Meldeart23</AccordionTrigger>
        <AccordionContent>5 candidates</AccordionContent>
      </AccordionItem>
      <AccordionItem value="b">
        <AccordionTrigger>MiKaDiv_FM_Personentypen</AccordionTrigger>
        <AccordionContent>127 candidates</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
}

import type { Meta, StoryObj } from "@storybook/react"
import { Card, CardHeader, CardTitle, CardContent } from "./card"

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
}
export default meta

type Story = StoryObj<typeof Card>

export const Default: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>fact-1</CardTitle>
      </CardHeader>
      <CardContent>MiKaDiv_FM_Meldeart23 / XPathSelector</CardContent>
    </Card>
  ),
}

import type { Meta, StoryObj } from "@storybook/react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "./card"
import { Badge } from "./badge"
import { Button } from "./button"

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

export const WithFooterAndAction: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>fact-1</CardTitle>
        <CardDescription>MiKaDiv_FM_Meldeart23 / XPathSelector</CardDescription>
        <CardAction>
          <Badge variant="destructive">Drift</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>Content changed since last citation.</CardContent>
      <CardFooter>
        <Button variant="outline" size="sm">
          Review
        </Button>
      </CardFooter>
    </Card>
  ),
}

export const Small: Story = {
  render: () => (
    <Card size="sm">
      <CardHeader>
        <CardTitle>fact-2</CardTitle>
      </CardHeader>
      <CardContent>A compact card, size="sm".</CardContent>
    </Card>
  ),
}

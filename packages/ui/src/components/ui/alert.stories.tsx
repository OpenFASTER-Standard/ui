import type { Meta, StoryObj } from "@storybook/react"
import { Alert, AlertTitle, AlertDescription } from "./alert"

const meta: Meta<typeof Alert> = {
  title: "UI/Alert",
  component: Alert,
}
export default meta

type Story = StoryObj<typeof Alert>

export const Default: Story = {
  render: () => (
    <Alert>
      <AlertTitle>Heads up</AlertTitle>
      <AlertDescription>This is an informational alert.</AlertDescription>
    </Alert>
  ),
}

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive">
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>Something went wrong.</AlertDescription>
    </Alert>
  ),
}

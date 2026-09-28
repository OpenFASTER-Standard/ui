import * as React from "react"
import { Form as FormPrimitive } from "@base-ui/react/form"
import { Field as FieldPrimitive } from "@base-ui/react/field"
import { cn } from "cn"

// Base UI's own Form/Field primitives are self-contained (no external
// form-state library required, unlike shadcn's usual react-hook-form-based
// Form) -- shadcn's own "base" (Base UI) registry has no generated Form
// component to pull from (confirmed live: `shadcn add form` returns an
// empty registry stub, `{"name": "form", "type": "registry:ui"}`, no
// files), so this wraps Base UI's real `@base-ui/react/form` and
// `@base-ui/react/field` directly, styled to match this project's other
// generated components. No FormField export: Base UI's Field.Root already
// carries a field's own scoping/identity, the role shadcn's react-hook-form
// pattern splits into a separate FormField -- that split isn't needed here.

const Form = FormPrimitive

function FormItem({ className, ...props }: React.ComponentProps<typeof FieldPrimitive.Root>) {
  return (
    <FieldPrimitive.Root
      data-slot="form-item"
      className={cn("grid gap-2", className)}
      {...props}
    />
  )
}

function FormLabel({ className, ...props }: React.ComponentProps<typeof FieldPrimitive.Label>) {
  return (
    <FieldPrimitive.Label
      data-slot="form-label"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  )
}

function FormControl(props: React.ComponentProps<typeof FieldPrimitive.Control>) {
  return <FieldPrimitive.Control data-slot="form-control" {...props} />
}

function FormMessage({ className, ...props }: React.ComponentProps<typeof FieldPrimitive.Error>) {
  return (
    <FieldPrimitive.Error
      data-slot="form-message"
      className={cn("text-sm text-destructive", className)}
      {...props}
    />
  )
}

export { Form, FormItem, FormLabel, FormControl, FormMessage }

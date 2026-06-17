# EduSankofa Component System - Frontend Integration

## 🎯 Overview

The EduSankofa component system has been successfully integrated into the React frontend. This provides a comprehensive, production-ready component library built on the EduSankofa design tokens.

## 📁 Integration Structure

```
src/
├── components/
│   └── edusankofa/
│       ├── index.js                 # Main component exports
│       ├── providers/
│       │   └── AppProviders.js     # Combined providers
│       └── utils/
│           └── cn.js              # Utility function
├── styles/
│   ├── tailwind.css               # Tailwind + custom styles
│   └── edusankofa-design-tokens.css # Design tokens
├── tailwind.config.js             # Tailwind configuration
├── postcss.config.js              # PostCSS configuration
└── package.json                   # Updated dependencies
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Import Components

```jsx
import { Button, Card, Typography, Input } from './components/edusankofa';
```

### 3. Use Components

```jsx
function MyComponent() {
  return (
    <Card>
      <Typography variant="h3">Welcome to EduSankofa</Typography>
      <Input placeholder="Enter your name" />
      <Button variant="primary">Submit</Button>
    </Card>
  );
}
```

## 🎨 Available Components

### Typography
- `Typography` - Base typography component
- `H1, H2, H3, H4, H5, H6` - Heading components
- `Body, BodyLarge, BodySmall` - Body text
- `Caption, Label, Overline` - Supporting text
- `TableHeader, TableBody, TableSmall` - Table typography
- `ButtonText, NavText` - Interactive text
- `BrandText, SuccessText, WarningText, ErrorText, InfoText` - Semantic text

### Buttons
- `Button` - Base button with variants
- `PrimaryButton, SecondaryButton, AccentButton` - Pre-styled buttons
- `OutlineButton, GhostButton, DestructiveButton` - Style variants
- `IconButton, LoadingButton, DropdownButton` - Specialized buttons

### Inputs
- `Input, TextInput, EmailInput, NumberInput, SearchInput` - Text inputs
- `PasswordInput` - Secure password input
- `Select, MultiSelect, SearchableSelect` - Dropdown selects
- `Textarea, AutoTextarea, RichTextarea` - Text areas
- `LabeledInput, LabeledSelect, LabeledTextarea` - Form field components

### Cards
- `Card` - Base card component
- `CardHeader, CardTitle, CardDescription, CardContent, CardFooter` - Card parts
- `StatsCard, ProfileCard, FeatureCard, AlertCard` - Specialized cards

### Badges
- `Badge` - Base badge with variants
- `StatusBadge, RoleBadge, GradeBadge, CountBadge` - Specialized badges
- `NotificationBadge, PillBadge, ChipBadge, ProgressBadge` - More badges

### Alerts
- `Alert` - Base alert component
- `SuccessAlert, WarningAlert, ErrorAlert, InfoAlert` - Pre-styled alerts
- `SimpleAlert, InlineAlert, BannerAlert, ProgressAlert` - Style variants

### Modals
- `Modal` - Base modal component
- `ModalHeader, ModalTitle, ModalDescription, ModalBody, ModalFooter` - Modal parts
- `ConfirmModal, AlertModal, FormModal` - Specialized modals

### Tables
- `Table` - Base table component
- `TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter` - Table parts
- `SelectableTable, SortableTable, PaginatedTable, ResponsiveTable` - Enhanced tables

### Dropdowns
- `Dropdown` - Base dropdown component
- `DropdownItem, DropdownSeparator, DropdownHeader, DropdownFooter` - Dropdown parts
- `MenuDropdown, UserDropdown, NotificationDropdown` - Specialized dropdowns

### Toasts
- `Toast` - Base toast component
- `SuccessToast, WarningToast, ErrorToast, InfoToast` - Pre-styled toasts
- `ToastContainer, ToastDisplay` - Toast management
- `useToast, useToastMessage` - Toast hooks

## 🎯 Design System

### Brand Colors
- **Red (Authority)** - Primary actions and administrative elements
- **Gold/Yellow (Education)** - Secondary actions and educational content
- **Green (Growth)** - Success states and growth metrics
- **Black (Contrast)** - Text, borders, and structural elements

### Typography
- **Font Family:** Inter (Google Font)
- **Font Sizes:** xs (12px) to 6xl (60px)
- **Font Weights:** Light (300) to ExtraBold (800)
- **Line Heights:** Tight (1.25) to Loose (2)

### Spacing
- **Scale:** 0 (0px) to 64 (256px)
- **Responsive:** Mobile-first approach
- **Consistent:** 4px base unit

### Accessibility
- **WCAG AA Compliant:** All color combinations meet contrast requirements
- **Keyboard Navigation:** Full keyboard support
- **Screen Reader Support:** Proper ARIA attributes
- **Focus Management:** Clear focus indicators

## 🌙 Dark Mode

The component system includes full dark mode support:

```jsx
// Add 'dark' class to enable dark mode
<html className="dark">
```

### Dark Mode Features
- **Automatic Color Inversion:** Proper contrast in dark mode
- **Semantic Colors:** Maintained meaning across themes
- **Smooth Transitions:** Animated theme switching
- **Accessibility:** WCAG AA compliant in both themes

## 🔧 Customization

### Using Design Tokens

```jsx
// Access design tokens via CSS variables
const myStyle = {
  backgroundColor: 'var(--color-primary-600)',
  color: 'var(--color-neutral-100)',
  padding: 'var(--space-4)',
  borderRadius: 'var(--radius-lg)',
};
```

### Custom Variants

```jsx
import { cn } from './components/edusankofa/utils/cn';

const customButton = cn(
  'btn',
  'bg-brand-authority',
  'hover:bg-brand-authority/90',
  'text-white'
);
```

### Theme Overrides

```css
/* Override design tokens */
:root {
  --color-primary-600: #your-brand-color;
  --font-family-sans: 'Your Font', sans-serif;
}
```

## 📱 Responsive Design

All components are responsive by default:

```jsx
// Responsive utilities are built-in
<Card className="p-4 md:p-6 lg:p-8">
  <Typography variant="h2" className="text-xl md:text-2xl lg:text-3xl">
    Responsive Heading
  </Typography>
</Card>
```

## 🚀 Performance

The component system is optimized for performance:

- **Tree Shaking:** Only import what you use
- **Minimal Dependencies:** Lightweight utility libraries
- **Efficient Rendering:** Optimized React components
- **CSS-in-JS:** Efficient Tailwind CSS usage

## 🧪 Testing

Components are designed with testing in mind:

```jsx
import { render, screen } from '@testing-library/react';
import { Button } from './components/edusankofa';

test('Button renders correctly', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByRole('button')).toBeInTheDocument();
});
```

## 🔍 Examples

### Complete Form Example

```jsx
import { Card, Typography, LabeledInput, Button } from './components/edusankofa';

function StudentForm() {
  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <Typography variant="h3">Add Student</Typography>
      </CardHeader>
      <CardContent className="space-y-4">
        <LabeledInput
          label="Student Name"
          placeholder="Enter student name"
          required
        />
        <LabeledInput
          label="Email"
          type="email"
          placeholder="student@school.edu.gh"
          required
        />
        <div className="flex space-x-2">
          <Button variant="primary" className="flex-1">
            Save Student
          </Button>
          <Button variant="outline" className="flex-1">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Dashboard Stats Example

```jsx
import { Card, StatsCard, Typography, Badge } from './components/edusankofa';

function DashboardStats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatsCard
        title="Total Students"
        value="1,234"
        change="+12% from last month"
        changeType="positive"
        variant="elevated"
      />
      <StatsCard
        title="Attendance Rate"
        value="94.5%"
        change="+2.3% from last week"
        changeType="positive"
        variant="elevated"
      />
      <StatsCard
        title="Pending Fees"
        value="45"
        change="-8% from last month"
        changeType="positive"
        variant="elevated"
      />
    </div>
  );
}
```

### Alert and Toast Example

```jsx
import { Alert, Button, useToastMessage } from './components/edusankofa';

function NotificationExample() {
  const { success, error, warning, info } = useToastMessage();

  const handleSave = () => {
    success('Success!', 'Student record has been saved.');
  };

  const handleError = () => {
    error('Error!', 'Failed to save student record.');
  };

  return (
    <div className="space-y-4">
      <Alert variant="success" dismissible>
        <AlertTitle>Success</AlertTitle>
        <AlertDescription>Your changes have been saved.</AlertDescription>
      </Alert>
      
      <div className="flex space-x-2">
        <Button onClick={handleSave}>Show Success Toast</Button>
        <Button onClick={handleError} variant="destructive">Show Error Toast</Button>
      </div>
    </div>
  );
}
```

## 🔄 Migration Guide

### From Existing Components

1. **Replace Basic Elements:**
   ```jsx
   // Before
   <button className="btn">Click me</button>
   
   // After
   <Button variant="primary">Click me</Button>
   ```

2. **Update Typography:**
   ```jsx
   // Before
   <h1 className="text-2xl font-bold">Title</h1>
   
   // After
   <Typography variant="h1">Title</Typography>
   ```

3. **Use Card Layouts:**
   ```jsx
   // Before
   <div className="bg-white p-4 rounded shadow">
     <h2>Card Title</h2>
     <p>Card content</p>
   </div>
   
   // After
   <Card>
     <CardHeader>
       <CardTitle>Card Title</CardTitle>
     </CardHeader>
     <CardContent>
       <Typography>Card content</Typography>
     </CardContent>
   </Card>
   ```

## 📚 Documentation

- **Component API:** Individual component documentation in each component file
- **Design Tokens:** `src/styles/edusankofa-design-tokens.css`
- **Tailwind Config:** `tailwind.config.js`
- **Examples:** See the examples section above

## 🤝 Contributing

When extending the component system:

1. **Follow Design Tokens:** Use the EduSankofa design tokens
2. **Maintain Accessibility:** Ensure WCAG compliance
3. **Test Thoroughly:** Include tests for new components
4. **Document Changes:** Update documentation
5. **Consider Dark Mode:** Ensure dark mode compatibility

---

**EduSankofa Component System** - Building beautiful, accessible interfaces for Ghana Basic School Management.

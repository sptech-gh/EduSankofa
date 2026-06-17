# Application Layout System - EduSankofa

## 🎯 Overview

A comprehensive layout system for the EduSankofa Basic School Management System, providing responsive navigation, theme management, and a modern user experience across all device sizes.

## 📁 Component Structure

```
src/components/layout/
├── AppLayout.js          # Main layout wrapper
├── Sidebar.js            # Collapsible sidebar navigation
├── TopNavigation.js      # Top navigation bar
├── Breadcrumbs.js        # Breadcrumb navigation
├── index.js             # Component exports
└── README.md            # This documentation
```

## 🏗️ Layout Architecture

### **AppLayout Component**
The main layout wrapper that orchestrates all layout components and manages global state.

```jsx
<AppLayout>
  <Sidebar />
  <div className="flex-1 flex flex-col">
    <TopNavigation />
    <main>
      <Outlet />
    </main>
  </div>
</AppLayout>
```

**Features:**
- **Responsive Design:** Adapts to mobile, tablet, and desktop
- **Theme Management:** Dark/light mode with persistence
- **Sidebar Control:** Collapsible sidebar with mobile behavior
- **State Management:** Centralized layout state
- **Accessibility:** Proper ARIA attributes and keyboard navigation

### **Sidebar Component**
Collapsible navigation sidebar with hierarchical menu structure.

**Features:**
- **Collapsible Sections:** Expandable menu groups
- **Active States:** Visual indication of current page
- **Badges:** Notification badges for menu items
- **Mobile Overlay:** Backdrop on mobile when open
- **User Profile:** User info in sidebar footer
- **Smooth Animations:** CSS transitions for open/close

**Navigation Structure:**
- **Main:** Dashboard, Analytics
- **Academic:** Students, Grades, Subjects, Attendance, Report Cards
- **Financial:** Fees Management, Payments
- **Communication:** Messages, Announcements, Notifications
- **School Setup:** Academic Years, Terms, Classes, Teacher Assignments, School Profile, Grading Settings
- **System:** Promotion, System Settings

### **TopNavigation Component**
Fixed top navigation bar with user controls and search.

**Features:**
- **Sidebar Toggle:** Mobile and desktop sidebar control
- **Breadcrumbs:** Navigation path indicator
- **Search Bar:** Global search functionality
- **Notifications:** Dropdown with unread count
- **User Menu:** Profile dropdown with logout
- **Theme Toggle:** Dark/light mode switcher
- **Responsive Design:** Adaptive layout for different screen sizes

### **Breadcrumbs Component**
Hierarchical navigation showing the current page path.

**Features:**
- **Auto-Generation:** Creates breadcrumbs from URL path
- **Smart Naming:** Converts URL segments to readable names
- **Special Cases:** Handles specific route naming conventions
- **Interactive Links:** Clickable breadcrumb segments
- **Responsive:** Hidden on mobile (shown in top nav)

## 📱 Responsive Behavior

### **Desktop (> 1024px)**
```
┌─────────────────────────────────────────────┐
│ Top Navigation (Full Width)                │
├─────────────────────────────────────────────┤
│ Sidebar │ Main Content Area                │
│ (256px) │                               │
│          │                               │
│          │                               │
│          │                               │
└─────────────────────────────────────────────┘
```

- **Sidebar:** Always visible, 256px width
- **Top Navigation:** Full width with all features
- **Content Area:** Takes remaining space
- **Breadcrumbs:** Visible in top navigation

### **Tablet (768px - 1024px)**
```
┌─────────────────────────────────────────────┐
│ Top Navigation (Full Width)                │
├─────────────────────────────────────────────┤
│ Sidebar │ Main Content Area                │
│ (256px) │                               │
│          │                               │
│          │                               │
│          │                               │
└─────────────────────────────────────────────┘
```

- **Sidebar:** Collapsible, 256px width when open
- **Top Navigation:** Full width with all features
- **Content Area:** Adjusts margin based on sidebar state
- **Breadcrumbs:** Visible in top navigation

### **Mobile (< 768px)**
```
┌─────────────────────────────────────────────┐
│ Top Navigation (Full Width)                │
├─────────────────────────────────────────────┤
│                                         │
│ Main Content Area                        │
│ (Full Width)                            │
│                                         │
│                                         │
│                                         │
└─────────────────────────────────────────────┘
```

- **Sidebar:** Hidden by default, overlay when open
- **Top Navigation:** Compact, essential features only
- **Content Area:** Full width
- **Breadcrumbs:** Integrated in top navigation
- **Mobile Menu:** Hamburger menu for sidebar access

## 🎨 State Management

### **useLayout Hook**
Centralized state management for layout functionality.

```jsx
const {
  sidebarOpen,
  isMobile,
  isDark,
  screenSize,
  toggleSidebar,
  toggleTheme,
  setSidebarState,
  isDesktop,
  isTablet,
  isLargeScreen,
  sidebarWidth,
  contentMargin
} = useLayout();
```

**State Values:**
- `sidebarOpen`: Boolean indicating if sidebar is open
- `isMobile`: Boolean indicating mobile screen size
- `isDark`: Boolean indicating dark mode preference
- `screenSize`: Current screen size category ('sm', 'md', 'lg', 'xl', '2xl')

**Computed Values:**
- `isDesktop`: Not mobile
- `isTablet`: Medium screen size
- `isLargeScreen`: XL or 2XL screen size
- `sidebarWidth`: CSS class for sidebar width
- `contentMargin`: CSS class for content margin

**Actions:**
- `toggleSidebar()`: Toggle sidebar open/closed
- `toggleTheme()`: Toggle dark/light mode
- `setSidebarState(open)`: Set sidebar state programmatically

### **Theme Management**
- **Persistence:** Saves preference in localStorage
- **System Preference:** Respects OS dark mode preference
- **Real-time Updates:** Immediate theme switching
- **CSS Variables:** Uses CSS custom properties
- **Component Awareness:** All components respond to theme changes

## 🎯 Layout Grid System

### **Container Classes**
```css
.container-responsive {
  @apply max-w-7xl mx-auto px-4 sm:px-6 lg:px-8;
}
```

**Breakpoints:**
- **sm:** 640px and up
- **md:** 768px and up
- **lg:** 1024px and up
- **xl:** 1280px and up
- **2xl:** 1536px and up

### **Grid Utilities**
- **Responsive Grid:** Tailwind's grid system
- **Flexbox Layout:** Flexible layouts
- **Spacing System:** Consistent spacing scale
- **Component Sizing:** Standardized component sizes

## 🔄 Sidebar Collapse Behavior

### **Desktop Behavior**
- **Default State:** Sidebar open
- **Toggle Action:** Manual toggle via button
- **Persistence:** Remembers user preference
- **Animation:** Smooth slide transition
- **Content Adjustment:** Content margin adjusts

### **Mobile Behavior**
- **Default State:** Sidebar closed
- **Toggle Action:** Opens overlay menu
- **Backdrop:** Dark overlay when open
- **Touch Gestures:** Swipe to close (future enhancement)
- **Auto-close:** Closes on route change

### **Collapse Animation**
```css
.sidebar {
  transition: transform 0.3s ease-in-out;
}

.sidebar.open {
  transform: translateX(0);
}

.sidebar.closed {
  transform: translateX(-100%);
}
```

## 📱 Mobile Navigation Pattern

### **Hamburger Menu**
- **Position:** Top-left in navigation bar
- **Icon:** Three-line menu icon
- **Action:** Opens sidebar overlay
- **Accessibility:** Proper ARIA labels

### **Overlay Menu**
- **Full Coverage:** Covers entire screen
- **Backdrop:** Semi-transparent dark background
- **Close Actions:** Click outside or X button
- **Animation:** Slide-in from left

### **Compact Navigation**
- **Essential Only:** Shows only critical navigation
- **Search Prominent:** Mobile search bar
- **User Menu:** Profile access
- **Theme Toggle:** Dark mode switch

## 🎨 Design Integration

### **EduSankofa Branding**
- **Logo:** Consistent shield logo
- **Colors:** Authority (Red), Education (Gold), Growth (Green)
- **Typography:** Inter font throughout
- **Spacing:** Consistent design token spacing

### **Dark Mode Support**
- **Complete Coverage:** All components support dark mode
- **Smooth Transitions:** Animated theme switching
- **Proper Contrast:** WCAG AA compliant in both themes
- **Component Adaptation:** Colors and shadows adjust appropriately

### **Accessibility Features**
- **Keyboard Navigation:** Full keyboard accessibility
- **Screen Reader Support:** Proper ARIA labels
- **Focus Management:** Logical tab order and focus indicators
- **High Contrast:** Meets WCAG AA standards
- **Touch Targets:** 44px minimum touch targets

## 🚀 Performance Optimizations

### **React Optimization**
- **Memoization:** Prevents unnecessary re-renders
- **State Isolation:** Local state where appropriate
- **Event Listeners:** Proper cleanup of event listeners
- **Lazy Loading:** Components loaded on demand

### **CSS Optimization**
- **Tailwind Purging:** Removes unused CSS
- **CSS Variables:** Efficient theme switching
- **Hardware Acceleration:** Smooth animations
- **Minimal Reflows:** Optimized layout calculations

### **Bundle Optimization**
- **Code Splitting:** Layout components in separate bundle
- **Tree Shaking:** Only used components included
- **Asset Optimization:** Compressed images and icons
- **Caching Strategy:** Proper cache headers

## 🧪 Testing Considerations

### **Unit Tests**
- **Component Rendering:** Verify components render correctly
- **State Management:** Test layout state changes
- **User Interactions:** Test toggle and navigation
- **Responsive Behavior:** Test different screen sizes

### **Integration Tests**
- **Navigation Flow:** Test complete navigation flows
- **Theme Switching:** Test dark/light mode
- **Sidebar Behavior:** Test collapse/expand functionality
- **Mobile Gestures:** Test mobile interactions

### **Accessibility Tests**
- **Screen Readers:** Test with screen readers
- **Keyboard Navigation:** Test keyboard-only usage
- **Color Contrast:** Verify WCAG compliance
- **Focus Management**: Test focus handling

## 📚 Usage Examples

### **Basic Layout Setup**
```jsx
import { AppLayout } from './components/layout';

function App() {
  return (
    <AppLayout>
      <YourPageContent />
    </AppLayout>
  );
}
```

### **Custom Layout Hook Usage**
```jsx
import { useLayout } from './hooks';

function MyComponent() {
  const { sidebarOpen, isMobile, toggleSidebar } = useLayout();
  
  return (
    <div>
      <button onClick={toggleSidebar}>
        Toggle Sidebar
      </button>
      <p>Sidebar is {sidebarOpen ? 'open' : 'closed'}</p>
      <p>Device is {isMobile ? 'mobile' : 'desktop'}</p>
    </div>
  );
}
```

### **Individual Component Usage**
```jsx
import { Sidebar, TopNavigation, Breadcrumbs } from './components/layout';

function CustomLayout() {
  return (
    <div className="h-screen flex">
      <Sidebar isOpen={true} />
      <div className="flex-1 flex flex-col">
        <TopNavigation />
        <main className="flex-1">
          <Breadcrumbs />
          <PageContent />
        </main>
      </div>
    </div>
  );
}
```

---

## 🎉 Summary

The EduSankofa layout system provides:

- ✅ **Responsive Design:** Works seamlessly across all device sizes
- ✅ **Modern Navigation:** Intuitive sidebar and top navigation
- ✅ **Theme Management:** Complete dark/light mode support
- ✅ **Accessibility:** WCAG AA compliant and keyboard accessible
- ✅ **Performance:** Optimized for production use
- ✅ **Brand Integration:** Consistent EduSankofa design
- ✅ **Developer Experience:** Easy to use and customize

**Ready for production implementation!** 🚀

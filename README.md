# Simple Dashboard

Simple Dashboard is a lightweight, modular web dashboard for visualizing numeric values, status data, and time series data.
The project is intentionally backend agnostic. Widgets consume HTTP endpoints with clearly defined response formats and fully encapsulate rendering, refresh logic, and time handling.

The core goals of the project are:
- explicit data contracts
- isolated and reusable widgets
- minimal implicit behavior
- simple extensibility

## Project Overview

The project consists of five major parts:

### Dashboard Core

The dashboard core is responsible for:
- grid based layout
- edit and view modes
- adding, removing, and rearranging widgets
- persistence of dashboards and widget configurations
- dashboard wide time range handling

A dashboard can define a global time range using presets such as last 6h, 12h, 24h, 7d or a custom from and to range. 
Widgets can consume this range automatically.

### Widgets

Widgets are fully self contained visual components.

Each widget handles:
- rendering
- data fetching
- refresh timing
- interpretation of the dashboard time range
- its own configuration and defaults

Widgets do not depend on each other and do not contain dashboard specific logic.


### Widget Configuration UI

Widgets are configured through a generic modal dialog.

The configuration UI is driven entirely by widget metadata.
No widget specific UI code is required outside the widget itself.

Supported field types include:
- text inputs
- number inputs
- select fields
- numeric ranges
- color ranges
- value sources
- data sources

### Data Contracts

All widgets communicate via HTTP endpoints.

General rules:
- timestamps are always milliseconds since epoch
- numeric values are expected where applicable
- endpoints must be idempotent
- widgets never mutate backend state

Widgets define their own expected response shape.
The dashboard core does not interpret response data.

### Dashboard Time Ranges

The dashboard can define a global time range.

This range is provided to widgets as:
- from timestamp in milliseconds
- to timestamp in milliseconds

Widgets may:
- fully respect the dashboard range
- ignore it if not applicable
- fall back to a widget local range if no dashboard range is active


## Supported Widgets


### Value 1x1

Displays a single value.

Typical use cases:
- sensor status values

This widget uses the **singleValueSource** API (see below)

The widget periodically fetches the endpoint and displays the value as text.


### Gauge 3x3

Displays a numeric value on a circular gauge.

Features:
- configurable minimum and maximum
- colored value ranges
- animated needle
- numeric value display

This widget uses the **singleValueSource** API (see below)

Color ranges are defined relative to the configured min and max values.


### Line Chart 6x4

Displays one or more time series.

Features:
- multiple series per chart
- configurable colors and labels
- optional Y axis limits
- dashboard wide time range support
- widget local fallback range

This widget uses the **multipleSeriesSource** API (see below)

The chart automatically applies the active dashboard time range.
If no dashboard range is set, the widget fallback range is used.

## Adding a New Widget

To add a new widget:
1. Create a new widget directory under public/widgets
2. Implement widget.js with the required lifecycle functions
3. Export a meta object describing the widget
4. Define configuration fields using supported field kinds
5. Register the widget so it can be selected in the UI

Each widget must export:
- meta
- mount
- update
- unmount

### Widget Configuration Fields

Widgets define their configuration UI through the meta.fields array.
Each field describes a single configurable parameter and how it is rendered in the widget configuration modal.
The configuration UI is generated automatically.
Widgets do not implement any widget specific configuration UI logic outside their own widget.js file.
Each field entry consists of a key, a kind, and optional metadata such as labels, defaults, and validation rules.

#### Common Field Properties

All field kinds support the following common properties:

- key: Unique identifier used as the configuration property name inside the widget config
- label: Human readable label shown in the configuration modal
- kind: Field type that defines rendering, validation, and parsing behavior
- required: If true, the field must be filled before the widget can be added
- help: Optional helper text shown below the field
- helpCode: Optional code styled hint shown together with the help text
- placeholder: Placeholder text for input fields

#### Supported Standard Field Kinds

- text: Simple text input. Value type: **string**
- number: Numeric input. Value type: **number** or empty string (Widgets may treat this as automatic or fallback behavior.)
- select: Dropdown selection. The resulting value type depends on the option value type.
- ranges: Defines a list of numeric ranges. Each entry contains a from and to value. Value type: **object** { from: number, to: number }.
- colorranges: Defines a list of numeric ranges with associated colors. Used for visual components such as gauges. Value type: **object** { from: number, to: number, color: string }.

#### Standard Kind Examples

Select example:

```
{
  key: "refreshMs",
  label: "Refresh Interval",
  kind: "select",
  required: true,
  options: [
    { value: 5000, label: "5s" },
    { value: 60000, label: "1m" }
  ]
}
```

Ranges example:

```
{
key: "ranges",
label: "Ranges",
kind: "ranges"
}
```

Color ranges example:

```
{
key: "ranges",
label: "Color ranges",
kind: "colorranges"
}
```

#### Supported Source Field Kinds

Source fields define where widgets fetch their data from. They are rendered as row based editors with add and remove controls. In the UI, source fields only allow specifying one or more data sources. The configuration itself is purely declarative. Widgets explicitly decide if, when, and how these sources are queried and how the returned data is interpreted or combined.

- singleValueSource: Defines a single source that returns exactly one value. Value type: **object** { endpoint: string, label optional string, paramKey optional string, paramValue optional string }
- multiValueSource: Defines multiple independent value sources. Value type: **array of objects** [ { endpoint: string, label: optional string, paramKey: optional string, paramValue: optional string } ]
- multiSeriesSource: Defines multiple series sources. Value type: **array of objects** [ { endpoint: string, label: string, color: string, paramKey: optional string, paramValue: optional string } ]

#### Source Kind Examples

singleValueSource example:

```
{
  key: "source",
  label: "Source",
  kind: "singleValueSource",
  required: true
}
```
multiValueSource example:

```
{
  key: "sources",
  label: "Sources",
  kind: "multiValueSource",
  maxRows: 3 // Number of possible source Endpoints for the widget (widget has to support this)
}
```

multiSeriesSource example:

```
{
  key: "sources",
  label: "Series",
  kind: "multiSeriesSource",
  required: true,
  maxRows: 3 // Number of possible source Endpoints for the widget (widget has to support this)
}
```

### Source Kind HTTP Request/Response API:

#### singleValueSource

HTTP request example:

```
GET http://server:port/api/latest
GET http://server:port/api/latest?key=value
...
```

Expected endpoint response:

```
{
  "value": 850
}
```

#### multiValueSource

Request/Response pattern the same as in the **singleValueSource**  kind.

#### singleSeriesSource

Not yet implemented!

#### multiSeriesSource

HTTP request example: (Time range is needed in all requests)

```
GET http://server:port/api/range?from_ts_ms=...&to_ts_ms=...
GET http://server:port/api/rangefrom_ts_ms=...&to_ts_ms=...&key=value
...
```

Expected endpoint response:

```
{
  "points": [
    [timestamp_ms, value],
    [timestamp_ms, value]
  ]
}
```

Endpoints are responsible for data resolution and sampling. Widgets only define the requested time range.

### Widget Runtime Context

Widgets run entirely in the browser and are mounted dynamically into the dashboard grid.
Each widget instance receives a context object that provides access to runtime information such as:

- the widget configuration
- the dashboard state
- the active dashboard time range

Widgets are responsible for interpreting this context themselves.

### Widget Lifecycle API

Each widget must export the following functions:

#### meta

Static metadata describing the widget. Defines:

- widget type identifier
- display label
- default grid size
- default configuration
- configuration fields

#### mount

Called when the widget is created. Responsible for:

- initial DOM creation
- initializing charts or visual components
- starting timers or data fetching

#### update

Called when the widget configuration changes. Responsible for:

- applying updated configuration
- restarting timers if required
- triggering re renders

#### unmount

Called when the widget is removed. Responsible for:

- clearing timers
- aborting fetch requests
- cleaning up DOM elements or chart instances


## Status

This project is under active development.

The architecture is intentionally flexible to allow additional widgets such as:
- bar charts
- scatter plots
- status grids
- derived or aggregated widgets

Smaller refinements and UI improvements are expected over time.

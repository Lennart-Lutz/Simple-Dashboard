# Simple Dashboard

Simple Dashboard is a lightweight, modular web dashboard for visualizing numeric values, status data, and time series data.
The project is intentionally backend agnostic. Widgets consume HTTP endpoints with clearly defined response formats and fully encapsulate rendering, refresh logic, and time handling.

The core goals of the project are:
- explicit data contracts
- isolated and reusable widgets
- minimal implicit behavior
- simple extensibility

## Project Overview

The project consists of three major parts:

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
- series sources

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

HTTP request example:

```
GET hhtp://server:port/api/latest
GET hhtp://server:port/api/latest?key=value
...
```

Expected endpoint response:

```
{
  "value": 42
}
```

The widget periodically fetches the endpoint and displays the value as text.


### Gauge 3x3

Displays a numeric value on a circular gauge.

Features:
- configurable minimum and maximum
- colored value ranges
- animated needle
- numeric value display

HTTP request example:

```
GET hhtp://server:port/api/latest
GET hhtp://server:port/api/latest?key=value
...
```

Expected endpoint response:

```
{
  "value": 850
}
```

Color ranges are defined relative to the configured min and max values.


### Line Chart 6x4

Displays one or more time series.

Features:
- multiple series per chart
- configurable colors and labels
- optional Y axis limits
- dashboard wide time range support
- widget local fallback range

HTTP request example: (Time range is needed in all requests)

```
GET hhtp://server:port/api/range?from_ts_ms=...&to_ts_ms=...
GET hhtp://server:port/api/rangefrom_ts_ms=...&to_ts_ms=...&key=value
...
```

Expected endpoint response for each series:

```
{
  "points": [
    [timestamp_ms, value],
    [timestamp_ms, value]
  ]
}
```

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


### Widget API

#### meta

Describes the widget:
- type
- label
- default size
- default configuration
- configuration fields


#### mount

Called when the widget is created.

Responsible for:
- initial rendering
- creating charts or DOM elements
- starting timers


#### update

Called when the widget configuration changes.

Responsible for:
- applying new configuration
- restarting timers if needed
- re rendering if necessary


#### unmount

Called when the widget is removed.

Responsible for:
- clearing timers
- aborting fetch requests
- cleaning up DOM or chart instances


## Status

This project is under active development.

The architecture is intentionally flexible to allow additional widgets such as:
- bar charts
- scatter plots
- status grids
- derived or aggregated widgets

Smaller refinements and UI improvements are expected over time.

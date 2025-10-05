# Special Relativity Simulator

A browser-based special relativity simulator that visualizes spacetime diagrams, length contraction, time dilation, and accelerated frames (such as in the twin paradox). This is a JavaScript port of the Python [relativipy](https://github.com/campagnola/relativipy) simulator.

Try it here: [https://campagnola.github.io/special_relativity/](https://campagnola.github.io/special_relativity/)

## Features

- **Worldline Plots**: Interactive spacetime diagrams showing the paths of objects through spacetime
- **Reference Frames**: View from both inertial (lab) frame and moving reference frames
- **Real-time Animation**: 1D visualization with proper time display, length contraction, and force arrows
- **Clock Objects**: Add multiple clocks with custom acceleration programs
- **Grid Objects**: Create arrays of synchronized clocks
- **Twin Paradox**: Explore the famous thought experiment with preset scenarios

## Usage

### Basic Controls

- **Duration**: Set the total simulation time
- **Animation Speed**: Control playback speed (0.0001x to 10x)
- **Reference Frame**: Choose which clock's frame to view from
- **Animate**: Toggle real-time animation
- **Time Slider**: Manually scrub through time

### Creating Objects

- **Add Clock**: Create individual clocks with custom properties
  - Position (x₀): Initial position in space
  - Velocity (v₀): Initial velocity (-1 to 1, in units of c)
  - Proper Time (t₀): Initial proper time offset
  - Size: Visual size of the clock
  - Color: Display color
  - Acceleration Commands: see below

- **Add Grid**: Create arrays of synchronized clocks
  - Count: Number of clocks in the grid
  - Spacing: Distance between adjacent clocks
  - Template: Base properties applied to all clocks

### Acceleration Programming

Each clock can have a custom acceleration program defined as a series of commands:

- **τ (s)**: Proper time when acceleration changes
- **a**: Acceleration value in appropriate units

Example program:
```
τ=0.0, a=0.5   # Accelerate for proper time
τ=3.0, a=0.0   # Coast at constant velocity
τ=8.0, a=-0.5  # Decelerate
```

Note: "proper time" here means "the time indicated on the travelling clock".
So in the example above, imagine we have a rocket that carries a clock and a pilot. 
When the clock reads 0.0, the pilot sets the throttle to 0.5. When the clock reads 3.0,
the pilot disables the engine.

Special Relativity Simulator
----------------------------

Luke Campagnola, 2025


What is this?
=============

As a high school student learning physics, I found relativity to be fascinatingly unintuitive and magical, and it raised more questions than could be answered by my teachers. A few years later I was working my way through a degree in physics and found that many of the questions I had failed to find answers to earlier seemed to elude even the professors of my department. I spent years looking for these answers, digging through academic literature, before finally working out a way to solve them for myself. This little simulation is the tool I wrote to answer all of those questions that had followed me from the years before.

This tool is a 1-dimensional simulator of special relativity. That means we can explore the baffling things that happen when we move at very fast speeds -- clocks desynchronizing, distances contracting and expanding again, and events occurring seemingly out of order. Importantly acceleration, and as seen from the perspective of an accelerated observer.

Despite being able to explore the consequences of special relativity in an accelerated reference frame, this is _not a general relativity simulator_. It knows nothing of gravity or the curvature of spacetime (although it is possible to simulate an event horizon).

This is a particularly nice problem for a simulation, because working out the math is hard. Textbooks (and the professors who teach them) tend to stick to problems that are known to be mathematically tractable, which means simplifying problems until we can solve them, and sometimes outright ignoring interesting questions because we can't. A simulation solves the probmel computationally instead, inviting us to ask questions a little more freely and gain intuition by seeing the results immediately. At the same time, we trade this for the deeper understanding that often only comes from solving a problem analytically.

How does it work?
=================

You, the user, get to create any number of flying clocks. Each clock starts at a particular location in space. Since we only simulate 1 spatial dimension, clock position is specified as a single value that places the clock anywhere left to right. Each clock is piloted by a simple machine - it has a table of acceleration commands, where each command says "when the clock says X, set acceleration to A". So each clock speeds up, slows down, or changes direction based on _its own time_. When we run the simulation, we get to see what the experiment looks like from the perspective of any individual clock.

This simulator does _not simulate the propagation of light_. Take an example: Alice zips away on a rocket, holding a clock in the window. Bob watches via telescope from earth and concludes that when one day has elapsed on his clock, only 20 hours have passed on Alice's clock. However, by that time, Alice is far away and it takes light a significant amount of time to travel from Alice's clock to Bob's telescope. How does that affect our measurements? In this simulation we explicitly _ignore_ that problem. What you see in the simulation is where Alice _actually is_ relative to Bob, not where she would appear to be given the time-lag of light travel. Another way of putting this is: what you see in the simulation is what Bob would report for Alice's clock if he _corrects_ for the delay of light propagation in his measurements. 

Under the hood, this works by:

1. Starting from an intertial frame, exactly calculate the path taken by each clock. Relativistic accelerations produce hyperbolic curves, and there is just a little extra work in figuring out where each hyperbolic arc ends and a new one begins (when a clock gets to the time of its next command).
2. Once we have solved the world lines for an inertial frame, it is just a matter of using a lorentz transform to map this result to any other frame. The tricky bit here is that if you are in an accelerted frame, then the lorentz transform continuously changes moment to moment. The resulting world lines are also solved exactly, and you can see the original source of those solutions here: https://github.com/campagnola/relativipy/blob/master/math.pdf










This is an experimental alternative event infrastructure that I was playing
around with to test out some ideas:

1. Publishing events at the class level (still allowing instance level publish)
2. Using prototypal inheritance when it seemed more appropriate than subclassing
3. Event facades that use get/set rather than direct property access
4. Avoid the IE memory leak issue rather than use an onunload sub cleanup
5. Conditional/generic event types: event definitions that handles multiple
types (e.g. node.on("key(A-C)", fn) )
6. N event subscription phases ("on" for DOM nodes, "on" and "after" by default
for custom events, but can be more for defined events)
7. More that I'm forgetting

Some of this is just playtime, and some of it is clearly unfinished, but there
are definitely ideas and implementations in this code that I like.

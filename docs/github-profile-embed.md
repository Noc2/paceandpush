# GitHub Profile Embed

Pace & Push exposes an SVG chart endpoint that can be embedded in a GitHub
profile README:

```md
![Pace & Push chart](https://paceandpush.com/api/embed/Noc2/chart.svg)
```

Replace `Noc2` with any public Pace & Push login. The chart is rendered as SVG
so it works in Markdown image embeds and stays small enough for profile pages.

The chart includes:

- current period score
- commit total
- kilometer total
- period score trend
- daily commit bars

The public endpoint uses short CDN cache headers so profile READMEs stay quick
while still refreshing throughout the day.

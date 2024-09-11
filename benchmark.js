benchmark = require("speedybenchmark")

benchmark.blackjack(1000000)

const express = require("express")

app = express()

app.get("/", (req, res) => {
  res.end("One sec")
})

app.listen(3000)
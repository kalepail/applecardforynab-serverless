import express from 'express'
import serverless from 'serverless-http'
import bodyParser from 'body-parser'
import cors from 'cors'

import Pool from './js/pg'
import { getYnabApi } from './js/ynab'
import _ from 'lodash'

const app = express()

app.use(cors())
app.use(bodyParser.json())

app.post('/refresh', async (req, res) => {
  try {
    if (!req.body.id)
      throw 400

    const id = req.body.id
    const account = await Pool.query(`
      SELECT * FROM accounts
      WHERE id = '${id}'
    `).then(res => res.rows[0])

    const parsedCipher = JSON.parse(Buffer.from(account.cipher, 'base64').toString('utf8'))

    if (parsedCipher.ct)
      throw 400

    const ynabAPI = await getYnabApi(parsedCipher)

    const accounts = await ynabAPI.accounts.getAccounts('default')
    .then(({data: {accounts}}) => accounts)

    res.json(accounts)
  }

  catch (err) {
    console.error(err)
    res.sendStatus(400)
  }
})

export default serverless(app)
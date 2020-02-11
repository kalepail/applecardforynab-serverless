import express from 'express'
import serverless from 'serverless-http'
import bodyParser from 'body-parser'
import cors from 'cors'
import axios from 'axios'
import * as ynab from 'ynab'
import _ from 'lodash'

import Pool from './js/pg'

const app = express()

app.use(cors())
app.use(bodyParser.json())

app.post('/access', async (req, res) => {
  try {
    if (
      !req.body.code
      || !req.body.id
    ) throw 400

    const code = req.body.code
    const id = req.body.id

    const account = await Pool.query(`
      SELECT * FROM accounts
      WHERE id='${id}'
    `).then(res => res.rows[0])

    const parsedCipher = JSON.parse(Buffer.from(account.cipher, 'base64').toString('utf8'))

    if (parsedCipher.ct)
      throw 400

    const accounts = await axios.post('https://app.youneedabudget.com/oauth/token', {
      client_id: process.env.YNAB_CLIENT_ID,
      client_secret: process.env.YNAB_CLIENT_SECRET,
      redirect_uri: process.env.NODE_ENV === 'development' ? 'http://localhost:3333' : 'https://applecardforynab.com',
      grant_type: 'authorization_code',
      code
    })
    .then(async ({data}) => {
      const ynabAPI = new ynab.API(data.access_token)

      const accounts = await ynabAPI.accounts.getAccounts('default')
      .then(({data: {accounts}}) => accounts)

      parsedCipher.ynab_access_token = data.access_token
      parsedCipher.ynab_refresh_token = data.refresh_token

      const cipher = Buffer.from(JSON.stringify(parsedCipher)).toString('base64')

      await Pool.query(`
        UPDATE accounts SET
          cipher='${cipher}'
        WHERE id='${id}'
      `)

      return accounts
    })

    res.json(accounts)
  }

  catch (err) {
    console.error(err)
    res.sendStatus(400)
  }
})

export default serverless(app)
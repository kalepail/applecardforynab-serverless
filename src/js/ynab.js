import axios from 'axios'
import * as ynab from 'ynab'
import Promise from 'bluebird'
import Papa from 'papaparse'
import moment from 'moment'
import BigNumber from 'bignumber.js'
import _ from 'lodash'
import sjcl from '@tinyanvil/sjcl'

import Pool from './pg'

export async function getYnabApi(parsedCipher, id, email) {
  let ynabAPI = new ynab.API(parsedCipher.ynab_access_token)

  await ynabAPI.user.getUser()
  .catch(() => {
    return axios.post('https://app.youneedabudget.com/oauth/token', {
      client_id: process.env.YNAB_CLIENT_ID,
      client_secret: process.env.YNAB_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: parsedCipher.ynab_refresh_token
    })
    .then(async ({data}) => {
      console.log('Refreshed Token')

      let cipher

      parsedCipher.ynab_access_token = data.access_token
      parsedCipher.ynab_refresh_token = data.refresh_token

      if (id && email)
        cipher = Buffer.from(sjcl.encrypt(
          email + id,
          JSON.stringify(parsedCipher)
        )).toString('base64')

      else
        cipher = Buffer.from(JSON.stringify(parsedCipher)).toString('base64')

      await Pool.query(`
        UPDATE accounts SET
          cipher='${cipher}'
        WHERE id='${id}'
      `)

      ynabAPI = new ynab.API(data.access_token)
    })
  })

  return ynabAPI
}

export async function sendYnabFiles(parsedCipher, files, id, email) {
  const ynabAPI = await getYnabApi(parsedCipher, id, email)

  return new Promise.mapSeries(files, (file) => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        transformHeader(header) {
          switch (header) {
            case 'Transaction Date':
            return 'Date'
            case 'Description':
            return 'Memo'
            case 'Merchant':
            return 'Payee'
            case 'Amount (USD)':
            return 'Amount'
            default:
            return header
          }
        },
        async complete({data}) {
          const now = moment.utc().format('YYYY-MM-DD')
          const transactions = _
          .chain(data)
          .orderBy(['Date', 'Clearing Date', 'Type', 'Amount', 'Payee', 'Memo', 'Category'], 'desc')
          .map((row, i) => {
            const amount = new BigNumber(row.Amount).times('-1000')

            return {
              import_id: `ACFYNAB:${amount.toFixed()}:${now}:${i}`,
              account_id: parsedCipher.ynab_account_id,
              date: moment(row.Date, 'MM/DD/YYYY').format('YYYY-MM-DD'),
              amount: amount.toFixed(),
              payee_name: row.Payee,
              memo: row.Memo,
              cleared: 'cleared'
            }
          })
          .value()

          try {
            await ynabAPI.transactions.createTransactions('default', {transactions})
            resolve()
          } catch(err) {
            reject(err)
          }
        },
        error(err) {
          reject(err)
        }
      })
    })
  })
}
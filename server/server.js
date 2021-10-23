import express from 'express'
import path from 'path'
import cors from 'cors'
import sockjs from 'sockjs'
import { renderToStaticNodeStream } from 'react-dom/server'
import React from 'react'
import axios from 'axios'

import cookieParser from 'cookie-parser'
import config from './config'
import Html from '../client/html'

const { readFile, writeFile, unlink } = require('fs').promises

require('colors')

let Root
try {
  // eslint-disable-next-line import/no-unresolved
  Root = require('../dist/assets/js/ssr/root.bundle').default
} catch {
  console.log('SSR not found. Please run "yarn run build:ssr"'.red)
}

let connections = []

const port = process.env.PORT || 8090
const server = express()

const setHeaders = (req, res, next) => {
  res.set('x-skillcrucial-user', '385666b1-bff5-11e9-95ba-1bf845c18f8d')
  res.set('Access-Control-Expose-Headers', 'X-SKILLCRUCIAL-USER')
  next()
}

const middleware = [
  cors(),
  express.static(path.resolve(__dirname, '../dist/assets')),
  express.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }),
  express.json({ limit: '50mb', extended: true }),
  cookieParser(),
  setHeaders
]

middleware.forEach((it) => server.use(it))

/*
get /api/v1/users - получает всех юзеров из файла users.json,
если его нет - получает данные с сервиса https://jsonplaceholder.typicode.com/users,
заполняет файл users.json полученными данными и возвращает эти данные пользователю.
*/

const globalUrl = 'https://jsonplaceholder.typicode.com/users'
const globalPath = `${__dirname}/data/users.json`

const getData = (url) => {
  const usersList = axios(url)
    .then(({ data }) => data)
    .catch((err) => {
      console.log(err)
      return []
    })
  return usersList
}

const writeNewFile = (finalArray) => {
  return writeFile(globalPath, JSON.stringify(finalArray), 'utf-8')
}

server.get('/api/v1/users', async (req, res) => {
  const userList = await readFile(globalPath, 'utf-8')
    .then((usersData) => {
      return JSON.parse(usersData)
    })
    .catch(async (err) => {
      console.log(err)
      const recievedData = await getData(globalUrl)
      await writeNewFile(recievedData)
      return recievedData
    })
  res.json(userList)
})

/*
delete /api/v1/users - удаляет файл users.json
*/

server.delete('/api/v1/users', (req, res) => {
  unlink(globalPath)
    .then(() => {
      res.json({ status: 'File deleted' })
    })
    .catch((err) => {
      console.log('Error: ', err)
      res.json({ status: 'No file' })
    })
})

/*
post /api/v1/users - добавляет юзера в файл users.json,
с id равным id последнего элемента + 1 и возвращает { status: 'success', id: id }
*/

server.post('/api/v1/users', async (req, res) => {
  const response = await readFile(globalPath, 'utf-8')
    .then(async (str) => {
      const parsedString = JSON.parse(str)
      const lastId = (parsedString[parsedString.length - 1]?.id || 0) + 1
      await writeNewFile([...parsedString, { ...req.body, id: lastId }])
      return { status: 'success', id: lastId }
    })
    .catch(async (err) => {
      console.log(err)
      await writeNewFile([{ ...req.body, id: 1 }])
      return { status: 'success', id: 1 }
    })
  res.json(response)
})

/*
delete /api/v1/users/:userId - удаляет юзера в users.json, 
с id равным userId, и возвращает { status: 'success', id: userId }
*/

server.delete('/api/v1/users/:userId', async (req, res) => {
  const response = await readFile(globalPath, 'utf-8')
    .then(async (str) => {
      const parsedString = JSON.parse(str)
      const filteredUsers = parsedString.filter((user) => {
        return +req.params.userId !== user.id
      })
      await writeNewFile(filteredUsers)
      return { status: 'success', id: +req.params.userId }
    })
    .catch(() => {
      return { status: 'no file exist', id: +req.params.userId }
    })
  res.json(response)
})

/*
patch /api/v1/users/:userId - получает новый объект, 
дополняет его полями юзера в users.json, 
с id равным userId, и возвращает { status: 'success', id: userId }
*/

server.patch('/api/v1/users/:userId', async (req, res) => {
  const { userId } = req.params
  const updatedUser = { ...req.body, id: +userId }
  const response = await readFile(globalPath, 'utf-8')
    .then(async (str) => {
      const parsedString = JSON.parse(str)
      const updatedList = parsedString.map((obj) => {
        return obj.id === +userId ? { ...obj, ...updatedUser } : obj
      })
      await writeNewFile(updatedList)
      return { status: 'success', id: +userId }
    })
    .catch(() => {
      return { status: 'no file exist', id: +userId }
    })
  res.json(response)
})

server.use('/api/', (req, res) => {
  res.status(404)
  res.end()
})

const [htmlStart, htmlEnd] = Html({
  body: 'separator',
  title: 'Skillcrucial'
}).split('separator')

server.get('/', (req, res) => {
  const appStream = renderToStaticNodeStream(<Root location={req.url} context={{}} />)
  res.write(htmlStart)
  appStream.pipe(res, { end: false })
  appStream.on('end', () => {
    res.write(htmlEnd)
    res.end()
  })
})

server.get('/*', (req, res) => {
  const appStream = renderToStaticNodeStream(<Root location={req.url} context={{}} />)
  res.write(htmlStart)
  appStream.pipe(res, { end: false })
  appStream.on('end', () => {
    res.write(htmlEnd)
    res.end()
  })
})

const app = server.listen(port)

if (config.isSocketsEnabled) {
  const echo = sockjs.createServer()
  echo.on('connection', (conn) => {
    connections.push(conn)
    conn.on('data', async () => {})

    conn.on('close', () => {
      connections = connections.filter((c) => c.readyState !== 3)
    })
  })
  echo.installHandlers(app, { prefix: '/ws' })
}
console.log(`Serving at http://localhost:${port}`)

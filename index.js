import joi from 'joi';
import express from "express";
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from "dotenv";
dotenv.config();
const api = process.env.DATABASE_URL;
const mongoClient = new MongoClient(api);
let db;

mongoClient.connect()
 .then(() => db = mongoClient.db())
 .catch((err) => console.log(err.message));


const app = express();
app.use(cors());
app.use(express.json());
const PORT = 5000;

const userSchema = joi.object({
    name: joi.string().required(),
    age: joi.number().required(),
    email: joi.string().email().required()
});



import dayjs from 'dayjs';


app.post('/participants', (req, res) => {
    const name = req.body.name;
    const currentTime = dayjs().format('HH:mm:ss');
    const message = {
        from: name,
        to: 'Todos',
        text: 'entra na sala...',
        type: 'status',
        time: currentTime
    };

    db.collection('participantes').findOne({ name: name })
        .then(participant => {
            if (participant) {
                res.status(409).send('Usuário já existe');
            } else {
                db.collection('participantes').insertOne({ name: name, lastStatus: Date.now() })
                    .then(() => {
                        db.collection('messages').insertOne(message)
                            .then(() => {
                                res.sendStatus(201);
                            })
                            .catch(error => {
                                console.log(error);
                                res.status(500).send('Erro interno do servidor');
                            });
                    })
                    .catch(error => {
                        console.log(error);
                        res.status(500).send('Erro interno do servidor');
                    });
            }
        })
        .catch(error => {
            console.log(error);
            res.status(500).send('Erro interno do servidor');
        });
});



app.get('/participants', (req, res) => {
    db.collection('participantes').find().toArray()
    .then(part => {
        res.send(part)
    })
    .catch(error => {
        console.log(error);
        res.status(500).send('Internal Server Error');
    });
});

app.post('/messages', (req, res) => {
    const schema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid('message', 'private_message').required()
    });

    const { error, value } = schema.validate(req.body);

    if (error) {
        res.status(422).send('Erro de validação');
        return;
    }

    const from = req.headers.user;
    const currentTime = dayjs().format('HH:mm:ss');
    const message = {
        from: from,
        to: value.to,
        text: value.text,
        type: value.type,
        time: currentTime
    };

    db.collection('participantes').findOne({ name: from })
        .then(participant => {
            if (!participant) {
                res.status(422).send('Remetente inválido');
                return;
            }

            db.collection('messages').insertOne(message)
                .then(() => {
                    res.sendStatus(201);
                })
                .catch(error => {
                    console.log(error);
                    res.status(500).send('Erro interno do servidor');
                });
        })
        .catch(error => {
            console.log(error);
            res.status(500).send('Erro interno do servidor');
        });
});

app.get('/messages', (req, res) => {
    const user = req.headers.user;
    const limit = parseInt(req.query.limit);

    if (isNaN(limit) || limit <= 0) {
        res.status(422).send('Limite inválido');
        return;
    }

    const query = {
        $or: [
            { type: 'message' },
            { from: 'Todos' },
            { to: user },
            { from: user }
        ]
    };

    db.collection('messages').find(query)
        .sort({ _id: -1 })
        .limit(limit)
        .toArray()
        .then(messages => {
            res.send(messages);
        })
        .catch(error => {
            console.log(error);
            res.status(500).send('Erro interno do servidor');
        });
});

app.post('/status', (req, res) => {
    const user = req.headers.user;
  
    if (!user) {
      res.status(404).send('Participante não encontrado');
      return;
    }
  
    db.collection('participantes')
      .findOne({ name: user })
      .then(participant => {
        if (!participant) {
          res.status(404).send('Participante não encontrado');
        } else {
          db.collection('participantes')
            .updateOne({ name: user }, { $set: { lastStatus: Date.now() } })
            .then(() => {
              res.sendStatus(200);
            })
            .catch(error => {
              console.log(error);
              res.status(500).send('Erro interno do servidor');
            });
        }
      })
      .catch(error => {
        console.log(error);
        res.status(500).send('Erro interno do servidor');
      });
  });
  



app.post('/tweets', (req, res) => {
    let tem = false;
    if (users.length === 0) {
        res.send('UNAUTHERIZED');
    }
    const now = req.body;
    users.forEach((x) => {
        if (x.username === now.username) {
            now.avatar = x.avatar
            tem = true
        }
    })
    if (tem) {
        tweets.push(now);
    }
    else {
        res.send('UNAUTHERIZED');
    }
    
    res.send(tweets);
})

app.get('/tweets', (req, res) => {
    const obj = obterUltimosElementos(tweets);
    res.send(obj);
})
app.listen(PORT, () => console.log('Listening n port ' + PORT));

/* 
{
	"username": "bopeesponja", 
	"avatar": "https://cdn.shopify.com/s/files/1/0150/0643/3380/files/Screen_Shot_2019-07-01_at_11.35.42_AM_370x230@2x.png" 
}

{
	"username": "bopeesponja",
    "tweet": "Eu amo hambúrguer de siri!"
}
*/


app.get('/', (req, res) => {
    res.send('Main Page')
})


/* function obterUltimosElementos(array) {
    const tamanhoArray = array.length;
    const quantidadeRetorno = Math.min(tamanhoArray, 10); // Obter o mínimo entre o tamanho do array e 10
    const ultimosElementos = array.slice(tamanhoArray - quantidadeRetorno);
    return ultimosElementos;
} */
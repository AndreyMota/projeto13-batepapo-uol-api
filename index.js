import joi from 'joi';
import express from "express";
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from "dotenv";
import dayjs from 'dayjs';

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

app.post('/participants', (req, res) => {
    const name = req.body.name;
    if (!name) {
        res.status(422).send('Nome inválido');
        return;
    }
    const currentTime = dayjs().format('HH:mm:ss');
    const message = {
        from: name,
        to: 'Todos',
        text: 'entra na sala...',
        type: 'status',
        time: currentTime
    };

    db.collection('participants').findOne({ name: name })
        .then(participant => {
            if (participant) {
                res.status(409).send('Usuário já existe');
            } else {
                const insertParticipant = () => {
                    db.collection('participants').insertOne({ name: name, lastStatus: Date.now() })
                        .then(() => {
                            db.collection('messages').insertOne(message)
                                .then(() => {
                                    res.status(201).send('Mensagem de status adicionada');

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
                };

                db.collection('participants').findOneAndUpdate(
                    { name: name },
                    { $set: { lastStatus: Date.now() } },
                    { upsert: true }
                )
                .then(() => {
                    insertParticipant();
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
    db.collection('participants').find().toArray()
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

    db.collection('participants').findOne({ name: from })
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
    
    const query = {
        $or: [
            { type: 'message' },
            { type: 'status' },
            { from: 'Todos' },
            { to: user },
            { from: user }
        ]
    };

    let messagesQuery = db.collection('messages').find(query).sort({ _id: -1 });

    if (!isNaN(limit) && limit > 0) {
        messagesQuery = messagesQuery.limit(limit);
    }

    messagesQuery.toArray()
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
  
    db.collection('participants')
      .findOne({ name: user })
      .then(participant => {
        if (!participant) {
          res.status(404).send('Participante não encontrado');
        } else {
          db.collection('participants')
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

setInterval(() => {
    const inactiveTimeThreshold = Date.now() - 10000; // 10 segundos atrás
  
    db.collection('participants')
      .find({ lastStatus: { $lt: inactiveTimeThreshold } })
      .toArray()
      .then(inactiveParticipants => {
        if (inactiveParticipants.length > 0) {
          const removedParticipants = inactiveParticipants.map(participant => participant.name);
  
          db.collection('participants')
            .deleteMany({ lastStatus: { $lt: inactiveTimeThreshold } })
            .then(() => {
              const currentTime = dayjs().format('HH:mm:ss');
  
              const messages = removedParticipants.map(participant => ({
                from: participant,
                to: 'Todos',
                text: 'foi removido por inatividade',
                type: 'status',
                time: currentTime
              }));
  
              db.collection('messages')
                .insertMany(messages)
                .then(() => {
                  console.log('Usuários removidos por inatividade: ', removedParticipants);
                })
                .catch(error => {
                  console.log('Erro ao salvar mensagens de remoção: ', error);
                });
            })
            .catch(error => {
              console.log('Erro ao remover participants inativos: ', error);
            });
        }
      })
      .catch(error => {
        console.log('Erro ao buscar participants inativos: ', error);
      });
  }, 15000); // Executar a cada 15 segundos

app.get('/', (req, res) => {
    res.send('Main Page');
});

app.listen(PORT, () => {
  console.log(`Servidor ouvindo na porta ${PORT}`);
});

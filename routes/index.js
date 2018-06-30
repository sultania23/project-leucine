var express = require('express');
var router = express.Router();
var fs = require('fs');
var multer = require('multer');
var AWS = require('aws-sdk');
var AZURE= require('azure-storage');
var mime = require('mime');
var mongoose = require('mongoose');
var db = mongoose.connection;
var mysql = require('mysql');
var path=require('path');


var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "testtest"
});

var GridFsStorage = require('multer-gridfs-storage');
var Grid = require('gridfs-stream');
var methodOverride = require('method-override');

require('dotenv').config();
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});


var storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, './public/uploads');
    },
    filename: function (req, file, callback) {
        // console.log(file);
        callback(null,file.originalname)
    }
});



var upload = multer({storage: storage}).single('file');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.sendFile(path.join(__dirname,'../','views','index.html'));
});


router.get('/download',function (req, res, next) {

     var filekey = req.query.name;

     con.query("select * from " + process.env.files_table +" where name='" + filekey + "' LIMIT 1",function (err,rows,result) {
         if (err) throw err;

         if(!rows.length)
         {
             res.end();
         }
         else if(rows[0].storage=="s3")
         {
             var params = {
                 Bucket : process.env.s3bucket,
                 Key : filekey
             }

             res.attachment(filekey);
             var fileStream = s3.getObject(params).createReadStream();
             res.setHeader('Content-disposition', 'attachment; filename=' + filekey);
             fileStream.pipe(res);
         }
         else if(rows[0].storage == 'local')
         {
             var file_path =   './public/uploads/' + filekey;

             if(fs.existsSync(file_path))
             {
                 var mimetype = mime.lookup(file_path);
                 res.setHeader('Content-disposition', 'attachment; filename=' + filekey);
                 res.setHeader('Content-type', mimetype);
                 var filestream = fs.createReadStream(file_path);
                 filestream.pipe(res);
             }
             else
             {
                 res.sendStatus(404).end("Not found");
             }
         }
         else if(rows[0].storage =='azure')
         {

            var  container_name = process.env.azure_container;

             var blobSvc = AZURE.createBlobService(process.env.azure_project, process.env.AZURE_ACCESS_KEY);

             blobSvc.getBlobProperties(
                 container_name,
                 filekey,
                 function(err, properties, status) {
                     if (err) {
                         res.send(502, "Error fetching file: %s", err.message);
                     } else if (!status.isSuccessful) {
                         res.send(404, "The files does not exist", filekey);
                     } else {
                         res.setHeader('Content-disposition', 'attachment; filename=' + filekey);
                         res.header('Content-Type', properties.contentType);
                         blobSvc.createReadStream(container_name, filekey).pipe(res);
                     }
                 });

         }
     })


})

router.post('/upload',upload,function (req, res, next) {

    var storage_type = process.env.current_storage;

    var file_path = './public/uploads/' + req.file.filename;
    var file_name = req.file.filename;
    if (!req.file ) {
        return res.status(403).send('expect 1 file upload named file').end();
    }
    else if(storage_type=='local')
    {
        var data = {
            name: file_name,
            path: 'local',
            storage: 'local'
        }
        x(data,function (err,data) {
            if(err) throw err;
        });
        res.end();
    }
    else if(storage_type=='s3')
    {
        fs.readFile(file_path, function (err, data) {
            if (err) throw err; // Something went wrong!

            const params = {
                Bucket: process.env.s3bucket,
                Key: req.file.filename,
                Body: data
            };
                s3.upload(params, function (err, data) {
                    // Whether there is an error or not, delete the temp file
                    fs.unlink(file_path, function (err) {
                        if (err) {
                        }
                    });

                    if (err) {
                        return res.status(500).send(err);
                    }
                    else {

                        var data = {
                            name: file_name,
                            path: 's3',
                            storage: 's3'
                        }

                        x(data,function (err,data) {
                            if(err) throw err;
                        });
                        return res.status(200).send(err);
                    }
                });
            });
        }
        else if(storage_type == 'azure')
        {

            var readStream = fs.createReadStream(file_path);

            var blobSvc = AZURE.createBlobService(process.env.azure_project, process.env.AZURE_ACCESS_KEY);
            blobSvc.createContainerIfNotExists(process.env.azure_container, function (error, result, response) {
                if (!error) {
                    // Container exists and is private
                    readStream.pipe(blobSvc.createWriteStreamToBlockBlob(process.env.azure_container, req.file.filename, function (error, result, response) {
                        if(!error) {
                            fs.unlink(file_path, function (err) {
                                if (err) {
                                }
                                // console.log('Temp File Delete');
                            });
                            var data = {
                                name: file_name,
                                path: 's3',
                                storage: 'azure'
                            }

                            x(data,function (err,data) {
                                if(err) throw err;
                            });
                            return res.status(200).end("File uploaded Successfully");
                        }
                        else
                        {
                            return res.status(500).end("Server ERROR");
                        }
                    }));
                }
                else
                {
                    return res.status(500).end("Server ERROR");
                }
            });
        }
        else if(storage_type=='mongodb')
        {
            const Schema = mongoose.Schema;

            var fileSchema = new Schema({
                name: String,
                data: { data: Buffer,contentType: String}
            }) ;
            var  fileModel = mongoose.model('fileSchema',fileSchema);

           var new_file = new fileModel;
           new_file.name= req.file.filename;
           new_file.data = fs.readFileSync(file_path);
           new_file.data.contentType = 'text/plain';

           new_file.save(function (err,new_file) {
               if(err) throw err;
           })
        }
});

router.get('/allfiles',function (req,res,next) {
    var new_con = mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "",
        database: "testtest"
    });
    new_con.connect(function(err) {
        if (err) throw err;
        var sql = "select * from " + process.env.files_table;
        new_con.query(sql, function (err, result) {
            if (err) throw err;
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(result));
            new_con.end();
            res.end();
        });
    });
});

router.get('/delete',function (req,res,next) {

    var name = req.query.name;
    var connn = mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "",
        database: "testtest"
    });

    connn.connect(function(err) {
        if (err) throw err;
        var sql = "select * from " + process.env.files_table +" where name='" + name + "' LIMIT 1";
        connn.query(sql, function (err, rows,result) {
            if (err) throw err;

            if(!rows.length)
            {
                res.end();
            }
            else if(rows[0].storage=="s3")
            {
                var params = {
                    Bucket: process.env.s3bucket,
                    Key: name
                };
                s3.deleteObject(params, function (err, data) {
                    if (data) {
                        // console.log("File deleted successfully");
                        try {
                            connn.query("delete from " + process.env.files_table +" where name='" + name + "'");
                            connn.end();
                        }
                        catch (e) {
                            // console.log(e);
                        }
                    }
                    else {
                        // console.log("Check if you have sufficient permissions : "+err);
                    }
                    res.end();
                });
            }
            else if(rows[0].storage=='local')
            {
                var file_path_to_delete = './public/uploads/' + name;

                fs.exists(file_path_to_delete,function (exists) {
                    if (exists) {
                        fs.unlink(file_path_to_delete, function (err) {
                            if (err) {
                            }
                            else {
                                try {
                                    con.query("delete from " + process.env.files_table + " where name='" + name + "'");
                                    con.end();
                                }
                                catch (e) {
                                    // console.log(e);
                                }
                                res.end();
                            }
                        });
                    }
                });
            }
            else if(rows[0].storage=='azure')
            {
                var blobSvc = AZURE.createBlobService(process.env.azure_project, process.env.AZURE_ACCESS_KEY);
                blobSvc.deleteBlobIfExists(process.env.azure_container,name, function (error) {
                   if(error)
                   {
                       res.end();
                   }
                   else
                   {
                       try {
                           con.query("delete from " + process.env.files_table +"  where name='" + name + "'");
                           con.end();
                       }
                       catch (e) {

                       }
                       res.end();
                   }

                });
            }

            // res.end();
            // // res.setHeader('Content-Type', 'application/json');
            // // res.send(JSON.stringify(result));
            // // res.end();
        });
    });
})



router.get('/rename',function (req,res,next) {

    var old_name = req.query.old_name;
    var new_name = req.query.new_name;

    con.connect(function(err) {
        if (err)
            throw err;
            var temp_select_query = "select * from " + process.env.files_table + "where name='" + old_name + "'limit 1";
            con.query("select * from files where name=we.txt", function (err,rows,fields) {
               console.log(rows);
                if (err)
                {
                    res.end();
                }
                else if (!rows.length) {
                   res.end();
                }
                else if (rows[0].storage=='s3') {
                   let copyParams = {
                       Bucket: process.env.s3bucket,
                       CopySource: process.env.s3bucket + "/" + old_name,
                       Key: new_name
                   }
                   s3.copyObject(copyParams,function (err, data) {
                       if(err)
                           throw err;
                       else
                       {
                           var delete_params =
                               {
                                   Bucket: process.env.s3bucket,
                                   Key: old_name,
                               };

                           s3.deleteObject(delete_params, function (err, data) {

                               if (err) {
                                   throw err;
                               }
                               else {
                                   var insert_query = "INSERT INTO " + process.env.files_table + " (name, address,storage) VALUES ('" + new_name + "','" + rows[0].address + "','" + rows[0].storage + "')";
                                   let delete_query = "delete from " + process.env.files_table +" where name='" + old_name + "'";
                                   con.query(delete_query, function (err, result) {
                                       if (err)
                                           throw err;
                                       else {
                                           con.query(insert_query, function (err, result) {
                                               con.end();
                                           });
                                           res.end();
                                       }

                                   })
                               }
                               res.end();
                           });
                       }
                   });
                }
                else if(rows[0].storage=='local')
                {

                            var old_path = "./public/uploads/" + rows[0].name;
                            var new_path = "./public/uploads/" + new_name;

                            if(fs.exists(old_path,function (exists) {
                                if(exists)
                                {
                                    fs.rename(old_path,new_path,function (err) {
                                        if(err)
                                        {
                                            res.end();
                                        }
                                        else
                                        {
                                            var insert_query = "INSERT INTO " + process.env.files_table +" (name, address,storage) VALUES ('" + new_name + "','" + rows[0].address + "','" + rows[0].storage + "')";
                                            let delete_query = "delete from " + process.env.files_table + " where name='" + old_name + "'";
                                            con.query(delete_query, function (err, result) {
                                                if (err)
                                                    throw err;
                                                else {
                                                    con.query(insert_query, function (err, result) {
                                                        con.end();
                                                    });
                                                    res.end();
                                                }
                                            })
                                        }
                                    })
                                }
                                else
                                {
                                    res.end();
                                }
                            }));

                        }
                    });

            });
});



function x (data,callback){
    var con = mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "",
        database: "testtest"
    });

    var name = data.name;
    var path = data.path;
    var storage = data.storage;

    con.connect(function(err) {
        if (err) throw err;
        var update_query = "UPDATE " + process.env.files_table+ " set name='"+ name + "',storage='" + storage + "',address='" + path + "' where name='" + name + "'";
        var select_query = "select name from " + process.env.files_table + " where name='" + name + "'";
        var insert_query = " INSERT INTO " + process.env.files_table +" (name, address,storage) VALUES ('" + name + "','" + path + "','" + storage + "')";
        con.query(select_query, function (err, result) {
            if (err) throw err;
            if(!result.length)
            {
                con.query(insert_query,function (err,reslt) {
                    if(err) throw err;
                })
            }
            else
            {
                con.query(update_query,function (er,reslt) {
                    // console.log("updated successfully");
                })
            }
            con.end();
        });
    })
}

module.exports = router;

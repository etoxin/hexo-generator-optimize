var uglify   = require('uglify-js'),
    imagemin = require('image-min'),
    cleanCSS = require('clean-css'),
    fs       = require('fs'),
    path     = require('path'),
    util     = require('util'),
    zlib     = require('zlib');

var concat   = require('concat-files');
var cheerio  = require('cheerio');
var async    = require('async');
var htmlminifier   = require('html-minifier');

var config = hexo.config.optimize;

// File types for Minify.
var supportedResources = {
     'js'  : function(content, opts) {
        if(config.js_min == true) {
          return uglify.minify(content, { fromString: true }).code
        }
      },
     'css' : function(content, opts) {
        if(config.css_min == true) {
           return cleanCSS().minify(content);
        }
      }

};

// Navigate a folder recursively and minify resources
var minify = function(item, opts) {
  fs.readdir(item, function(err, files) {
      if (!files) return;
      files.forEach(function(file) {
          var target = path.join(item, file);
          var stats = fs.statSync(target);
          if ( stats.isDirectory() ) {
              minify(target, opts);
          } else if (stats.isFile()) {
              compress(target, opts);
          }
      });
  });
};

// ignore files that are already minified
var alreadyPacked = function(filename) {
    return (filename.indexOf(".min") > 0 ||
                filename.indexOf(".pack") > 0);
};

// Util to check if we have a minification strategy for given file extension
var processable = function(fileExt) {
    return (Object.keys(supportedResources)
                    .indexOf(fileExt) > -1);
};

// Define Files names for concat files

var desPathJs = hexo.public_dir+"js/final.js";
var desPathCss = hexo.public_dir+"css/finalcss.css";

jsFilesArr  = new Array();
cssFilesArr = new Array();
htmlFiles   = new Array();

// Get all files in public folder
var getFiles = function(dir)  {
    var files = fs.readdirSync(dir);
    for(var i in files){
        if (!files.hasOwnProperty(i)) continue;
        var name = dir+'/'+files[i];
        if (fs.statSync(name).isDirectory()){
            getFiles(name);
        }else{
            var i = name.lastIndexOf('.');
            var ext = (i < 0) ? '' : name.substr(i);
            if(ext == '.js')
              jsFilesArr.push(name);
            if(ext == '.css')
              cssFilesArr.push(name)
            if(ext == '.html')
              htmlFiles.push(name);
        }
    }
};

var newjsArr = new Array();
var newcssArr = new Array();

// Check Files for concat.
var checkFilesForConcat = function(tag, callback) {
  for(i in htmlFiles) {
    fs.readFile(htmlFiles[i], 'utf8', function (err, data) {
         $ = cheerio.load( data );
         $(tag).each(function(i, elem) {
            if(tag == 'script') {
              var src = $(elem).attr('src');
              filesArr = jsFilesArr;
            }
            else {
              var src = $(elem).attr('href');
              filesArr = cssFilesArr;
            }
            if (!/com/i.test(src)) {
              v1 = src.replace(/^.*(\\|\/|\:)/, '');
              for( n in filesArr ){
                jsfils = filesArr[n];
                v2 = jsfils.replace(/^.*(\\|\/|\:)/, '');
                if(v2 == v1){
                   callback(jsfils);
                }
              }
            }
        });
     });
   }
}

// Concatenate JS Files in One File (Save in public/js folder)
var concatJsFiles = function() {
  checkFilesForConcat('script' ,function(data){
      newjsArr.push(data);
      newjsArr1 = newjsArr.filter(function(elem, pos, self) {
          return self.indexOf(elem) == pos;
      })
      concat(newjsArr1 , desPathJs , function() {
      });
  });
};

// Concatenate CSS Files in One File (Save in public/css folder)
var concatCssFiles = function() {
    checkFilesForConcat('link[rel="stylesheet"]' ,function(data){
      newcssArr.push(data);
      newcssArr1 = newcssArr.filter(function(elem, pos, self) {
          return self.indexOf(elem) == pos;
      })
      concat(newcssArr1 , desPathCss , function() {
      });
  });
};


var getFileContent = function (srcPath, callback) {
    var ord = Math.random()*10000000000000000;
    fs.readFile(srcPath, 'utf8', function (err, data) {
       $ = cheerio.load( data );
       $('script').each(function(i, elem) {
          var src = $(elem).attr('src');
          var lastIndex = $("script").length - 1;
          if (!/com/i.test(src)) {
            if(i == lastIndex ) {
              $(this).attr('src','js/final.js?'+ord);
            }else {
              $(this).attr('src','');
            }
          }
        });
       $('link[rel="stylesheet"]').each(function(i, elem) {
          var src = $(elem).attr('href');
          if (!/com/i.test(src)) {
            if(i == 1 ) {
              $(this).attr('href','css/finalcss.css?'+ord);
            }else {
              $(this).attr('href','');
            }
          }
       });

        if (err) throw err;
        if(typeof config.html_min == 'undefined' || config.html_min == true ){
             var minifiedHTML = htmlminifier.minify($.html(), {
                 removeComments: true,
                 removeCommentsFromCDATA: true,
                 collapseWhitespace: true,
                 collapseBooleanAttributes: true,
                 removeEmptyAttributes: true
              });
              callback(minifiedHTML);
          }
          else {
              callback($.html())
          }
    });
}

var copyFileContent = function (savPath, srcPath) {
    getFileContent(srcPath, function(data) {
        fs.writeFile (savPath, data, function(err) {
            if (err) throw err;
        });
    });
}

var upfiles = function() {
  for(i in htmlFiles) {
    copyFileContent(htmlFiles[i] , htmlFiles[i]);
  }
};

// Perform file content minification overwriting the original content
var compress = function(filename, opts) {
    var fileExt = path.extname(filename||'').replace(".","");

    // Compress Images
    if(typeof config.image_min == 'undefined' || config.image_min == true ){

        if(fileExt == 'png' || fileExt == 'jpg' || fileExt == 'jpeg' || fileExt == 'gif') {
         imagemin(filename , filename, { optimizationLevel: 7 }, function (err, data) {
              console.log('Images Compressed!!');
          });
      }
    }

    if (alreadyPacked(filename) || !processable(fileExt)) return;
    var originalContent = fs.readFileSync(filename).toString();
    var minifiedContent = supportedResources[fileExt](originalContent, opts);
    if (minifiedContent) {
        if (!opts.silent) {
            console.log("[info] Minify: " + filename.replace(hexo.public_dir, ""));
        }
        fs.unlink( filename, function ( err ) {
            if ( err ) throw err;
            fs.writeFile(filename, minifiedContent, 'utf8', function(err) {
                if (err) throw err;
            })
        });
    }
};

// Gzip Html files of public folder
var gzipHtml = function(){
   var baseDir = hexo.base_dir;
   var gzip = zlib.createGzip('level=9');
   var start = Date.now();
   var traverseFileSystem = function (currentPath) {
      var files = fs.readdirSync(currentPath);
      for (var i in files) {
         var currentFile = currentPath + '/' + files[i];
         var stats = fs.statSync(currentFile);
         if (stats.isFile()) {
            if(currentFile.match(/\.(html)$/)) {
               var gzip = zlib.createGzip();
               var inp = fs.createReadStream(currentFile);
               var out = fs.createWriteStream(currentFile+'.gz');
               inp.pipe(gzip).pipe(out);
               console.log('['+'create'.green+'] '+currentFile+'.gz');
            }
         }
        else if (stats.isDirectory()) {
               traverseFileSystem(currentFile);
             }
       }
     };
   traverseFileSystem(baseDir+'public');
   var finish = Date.now();
   var elapsed = (finish - start) / 1000;
};
var optimize = function(args) {
    async.series([
        function(next) {
            hexo.call("generate", next)
        },
        function(next) {
            getFiles(hexo.public_dir);
            if(typeof config.gzip == 'undefined' || config.gzip == true ){
                gzipHtml();
            }
            next(null,null);
        },
        function(callback) {
            if (fs.existsSync(hexo.public_dir)) {
                minify(hexo.public_dir, args);
            } else {
                throw new Error(hexo.public_dir + " NOT found.")
            }
            callback(null, null);
        },
        function(callback) {
          if(typeof config.js_concat == 'undefined' || config.js_concat == true ){
              concatJsFiles();
          }
          callback(null, null);
        },
        function(callback) {
          if(typeof config.css_concat == 'undefined' || config.css_concat == true ){
              concatCssFiles();
          }
          callback(null, null);
        },
        function(callback) {
            upfiles();
            callback(null, null);
        },
        function( callback) {
            if(args.d == true) {
              hexo.call("deploy" , callback);
              callback(null, null);
            }
        },
    ], function(err){
        if (err) {
            util.error("[error] Minify: -> " + err.message);
        }
    });
};

// Plugin hook function.
hexo.extend.console.register('optimize', 'Hexo Generator Optimize', function(args) {
    optimize(args);
});
hexo.extend.console.register('o', 'Hexo Generator Optimize', function(args) {
    optimize(args);
});
hexo.extend.console.register('od', 'Hexo Generator Optimize', function(args) {
    args.d = true;
    optimize(args);
});

var app = angular.module('angularjs',[]);
app.controller('myController', function($scope, $http) {
    $scope.data = "";
    // $scope.gethomepage = function () {
    //     var request  = $http.get('/allfiles');
    //     request.success(function(data) {
    //         $scope.data = data;
    //     });
    //     request.error(function(data){
    //         console.log('Error: ' + data);
    //     });
    // };

    $scope.cmpl=0;
    $scope.file_upload_url = "http://localhost:3000/upload";

    $scope.uploadFile = function(){

        var file = $scope.myFile;
        var fd = new FormData();
        fd.append('file',file);


        if(file)
        {
            var fileSize = 0;
            if (file.size > 1024 * 1024)
                fileSize = (Math.round(file.size * 100 / (1024 * 1024)) / 100).toString() + 'MB';
            else
                fileSize = (Math.round(file.size * 100 / 1024) / 100).toString() + 'KB';
        }

        var xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress",uploadProgress,false);
        xhr.addEventListener("load", uploadComplete, false);
        xhr.addEventListener("error", uploadFailed, false);
        xhr.addEventListener("abort", uploadCanceled, false);

        xhr.open('POST', $scope.file_upload_url, true);
        xhr.onreadystatechange = function() {//Call a function when the state changes.
            if(xhr.readyState == 4  && xhr.status == 200) {
                alert("file uploaded successfully");
                $scope.getallfiles();
            }
        }
        xhr.send(fd);

        function uploadProgress(evt) {
            if (evt.lengthComputable) {
                var percentComplete = Math.round(evt.loaded * 100 / evt.total);

                // document.getElementById('ProgressNumber').width = Math.round(percentComplete);
                document.getElementById('ProgressNumber').innerHTML = percentComplete.toString() + '%';
            }
            else {
                document.getElementById('ProgressNumber').innerHTML = 'unable to compute';
            }
        }
        function uploadComplete(evt) {
            // alert(evt.target.responseText);
        }
        function uploadFailed(evt) {
            alert("There was an error attempting to upload the file.");
        }

        function uploadCanceled(evt) {
            alert("The upload has been canceled by the user or the browser dropped the connection.");
        }
    };


    $scope.getallfiles = function () {
        var url  = '/allfiles';
        var request = $http.get(url);
        request.success(function(data) {
            for(var i=0;i<data.length;i++)
            {
               data[i]['rename'] = "";
            }
            $scope.data = data;

        });
        request.error(function(data){
            console.log('Error: ' + data);
        });

    };

    $scope.delete_file = function(item){
        var url = '/delete?name=' + item.name;
        var request = $http.get(url);
        request.success(function (data) {
            alert("Successfully deleted..");
        });
        request.error(function (data) {
            alert("error...");
        });
        // $scope.getallfiles();
    };

    $scope.download_file = function(item){
        var url = '/download?name=' + item.name;
        var request = $http.get(url);
        request.success(function (data,status,headers) {

        });
        request.error(function (data) {
            alert("error in downloading file...");
        })
    }
    $scope.rename = function(item)
    {
        var new_name = item.rename;
        var old_name = item.name;

        if(new_name!=undefined && new_name.length>0)
        {

            var url = '/rename?old_name=' + old_name + "&new_name="+ new_name;
            var request = $http.get(url);
            request.success(function (status) {

            });
            request.error(function (data) {
                console.log("errorrr");
            });
        }
        else
        {
            alert("name cann't be empty");
        }
    }

    $scope.getallfiles();




});
app.directive('fileModel', ['$parse', function ($parse) {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            var model = $parse(attrs.fileModel);
            var modelSetter = model.assign;

            element.bind('change', function(){
                scope.$apply(function(){
                    modelSetter(scope, element[0].files[0]);
                });
            });
        }
    };
}]);